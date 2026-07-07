import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service';
import { MfaService } from '../src/auth/mfa.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    refreshToken: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockMfa = {
    generateSecret: jest.fn().mockReturnValue('MOCKSECRET'),
    getOtpAuthUrl: jest.fn().mockReturnValue('otpauth://totp/UCMS:test'),
    generateQrCodeDataUrl: jest.fn().mockResolvedValue('data:image/png;base64,...'),
    verifyToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('secret') },
        },
        { provide: MfaService, useValue: mockMfa },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    prisma = moduleRef.get(PrismaService);
  });

  describe('register', () => {
    it('throws ConflictException when the email is already taken for the tenant', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register(TENANT_ID, {
          email: 'pastor@church.rw',
          password: 'Password1',
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes the password and creates the user on success', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // uniqueness check
        .mockResolvedValueOnce({ id: 'new-user', firstName: 'John', lastName: 'Doe' }); // issueSession lookup
      mockPrisma.user.create.mockResolvedValue({ id: 'new-user' });

      const result = await service.register(TENANT_ID, {
        email: 'pastor@church.rw',
        password: 'Password1',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(mockPrisma.user.create).toHaveBeenCalled();
      const createArgs = mockPrisma.user.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).not.toBe('Password1'); // never store plaintext
      expect(await bcrypt.compare('Password1', createArgs.data.passwordHash)).toBe(true);
      expect(result.tokens.accessToken).toBe('signed.jwt.token');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for an unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login(TENANT_ID, { email: 'nobody@church.rw', password: 'whatever1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        deletedAt: null,
        passwordHash,
        userRoles: [],
      });

      await expect(
        service.login(TENANT_ID, { email: 'pastor@church.rw', password: 'WrongPass1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an inactive user even with the right password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: false,
        deletedAt: null,
        passwordHash,
        userRoles: [],
      });

      await expect(
        service.login(TENANT_ID, { email: 'pastor@church.rw', password: 'CorrectPass1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens and flattens role permissions on success', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'pastor@church.rw',
          isActive: true,
          deletedAt: null,
          passwordHash,
          userRoles: [
            {
              role: {
                name: 'Pastor',
                rolePermissions: [{ permission: { code: 'user.read' } }, { permission: { code: 'user.read' } }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({ id: 'user-1', firstName: 'Pastor', lastName: 'John' });

      const result = await service.login(TENANT_ID, { email: 'pastor@church.rw', password: 'CorrectPass1' });

      expect(result.user.roles).toEqual(['Pastor']);
      expect(result.user.permissions).toEqual(['user.read']); // deduplicated
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'auth.login' }) }),
      );
    });
  });

  describe('refresh', () => {
    it('rejects an unknown or already-revoked token', async () => {
      mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refresh(TENANT_ID, 'user-1', 'stale-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh(TENANT_ID, 'user-1', 'expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rotates the token: revokes the old one and issues a new pair', async () => {
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        expiresAt: new Date(Date.now() + 100_000),
      });
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1', isActive: true, userRoles: [] })
        .mockResolvedValueOnce({ id: 'user-1', firstName: 'A', lastName: 'B' });

      await service.refresh(TENANT_ID, 'user-1', 'valid-token');

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-1' }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
      );
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled(); // new token issued
    });
  });

  describe('logout', () => {
    it('revokes only the matching refresh token', async () => {
      await service.logout(TENANT_ID, 'user-1', 'some-token');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, userId: 'user-1', revokedAt: null }),
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('logoutAll', () => {
    it('revokes every active refresh token for the user', async () => {
      await service.logoutAll(TENANT_ID, 'user-1');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, userId: 'user-1', revokedAt: null },
        }),
      );
    });
  });

  describe('login with MFA enabled', () => {
    const mfaUser = async () => ({
      id: 'user-1',
      email: 'pastor@church.rw',
      isActive: true,
      deletedAt: null,
      passwordHash: await bcrypt.hash('CorrectPass1', 12),
      mfaEnabled: true,
      mfaSecret: 'MOCKSECRET',
      userRoles: [],
    });

    it('throws MFA_REQUIRED when no code is provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(await mfaUser());

      await expect(
        service.login(TENANT_ID, { email: 'pastor@church.rw', password: 'CorrectPass1' }),
      ).rejects.toMatchObject({ response: { code: 'MFA_REQUIRED' } });
    });

    it('throws MFA_INVALID when the code is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(await mfaUser());
      mockMfa.verifyToken.mockReturnValue(false);

      await expect(
        service.login(TENANT_ID, { email: 'pastor@church.rw', password: 'CorrectPass1', mfaCode: '000000' }),
      ).rejects.toMatchObject({ response: { code: 'MFA_INVALID' } });
    });

    it('succeeds when the code is valid', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(await mfaUser())
        .mockResolvedValueOnce({ id: 'user-1', firstName: 'Pastor', lastName: 'John' });
      mockMfa.verifyToken.mockReturnValue(true);

      const result = await service.login(TENANT_ID, {
        email: 'pastor@church.rw',
        password: 'CorrectPass1',
        mfaCode: '123456',
      });

      expect(result.tokens.accessToken).toBe('signed.jwt.token');
    });
  });

  describe('setupMfa', () => {
    it('generates and persists a new secret, returning a QR code', async () => {
      const result = await service.setupMfa(TENANT_ID, 'user-1', 'pastor@church.rw');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1', tenantId: TENANT_ID }, data: { mfaSecret: 'MOCKSECRET' } }),
      );
      expect(result.secret).toBe('MOCKSECRET');
      expect(result.qrCodeDataUrl).toContain('data:image/png');
    });
  });

  describe('enableMfa', () => {
    it('throws BadRequestException for an invalid code', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ mfaSecret: 'MOCKSECRET' });
      mockMfa.verifyToken.mockReturnValue(false);

      await expect(service.enableMfa(TENANT_ID, 'user-1', '000000')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('enables MFA for a valid code', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ mfaSecret: 'MOCKSECRET' });
      mockMfa.verifyToken.mockReturnValue(true);

      await service.enableMfa(TENANT_ID, 'user-1', '123456');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1', tenantId: TENANT_ID }, data: { mfaEnabled: true } }),
      );
    });
  });

  describe('disableMfa', () => {
    it('clears mfaEnabled and the secret for a valid code', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ mfaSecret: 'MOCKSECRET' });
      mockMfa.verifyToken.mockReturnValue(true);

      await service.disableMfa(TENANT_ID, 'user-1', '123456');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1', tenantId: TENANT_ID },
          data: { mfaEnabled: false, mfaSecret: null },
        }),
      );
    });
  });
});
