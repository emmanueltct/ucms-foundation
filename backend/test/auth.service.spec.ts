import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service';
import { MfaService } from '../src/auth/mfa.service';
import { NotificationsService } from '../src/communication/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { SecuritySettingsService } from '../src/security-settings/security-settings.service';
import { AuthResponseDto, WorkspaceSelectionResponseDto } from '../src/auth/dto/auth-response.dto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;

  const TENANT_ID = 'tenant-1';

  const TENANT_SLUG = 'demo-church';

  const mockPrisma = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    tenant: { findFirst: jest.fn(), findUnique: jest.fn() },
    refreshToken: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    passwordResetToken: { create: jest.fn(), update: jest.fn() },
    emailVerificationToken: { create: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn(), findMany: jest.fn() },
    unscoped: {
      user: { findMany: jest.fn(), findUnique: jest.fn() },
      passwordResetToken: { findUnique: jest.fn() },
      emailVerificationToken: { findUnique: jest.fn() },
    },
  };

  const mockMfa = {
    generateSecret: jest.fn().mockReturnValue('MOCKSECRET'),
    getOtpAuthUrl: jest.fn().mockReturnValue('otpauth://totp/UCMS:test'),
    generateQrCodeDataUrl: jest.fn().mockResolvedValue('data:image/png;base64,...'),
    verifyToken: jest.fn(),
  };

  const mockNotifications = {
    create: jest.fn(),
  };

  const mockSecuritySettings = {
    getEffective: jest.fn().mockResolvedValue({
      accessTokenTtlMinutes: 15,
      refreshTokenTtlDays: 7,
      inactivityLogoutMinutes: null,
      maxConcurrentSessions: null,
    }),
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
        { provide: NotificationsService, useValue: mockNotifications },
        AuditService, // real instance around the same mocked PrismaService, so existing auditLog.create assertions keep working unchanged
        { provide: SecuritySettingsService, useValue: mockSecuritySettings },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    prisma = moduleRef.get(PrismaService);
  });

  describe('register', () => {
    it('throws ConflictException when the email is already taken for the tenant', async () => {
      mockPrisma.unscoped.user.findUnique.mockResolvedValue({ id: 'existing-user' });

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
      mockPrisma.unscoped.user.findUnique.mockResolvedValueOnce(null); // uniqueness check
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'new-user', firstName: 'John', lastName: 'Doe' }); // issueSession lookup
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

    it('sends a verification email after creating the user, without blocking registration on a dispatch failure', async () => {
      mockPrisma.unscoped.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'new-user', firstName: 'John', lastName: 'Doe' });
      mockPrisma.user.create.mockResolvedValue({ id: 'new-user' });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, name: 'Demo Church' });
      mockNotifications.create.mockRejectedValue(new Error('gateway is a stub'));

      const result = await service.register(TENANT_ID, {
        email: 'pastor@church.rw',
        password: 'Password1',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_ID, userId: 'new-user' }) }),
      );
      expect(mockNotifications.create).toHaveBeenCalled();
      expect(result.tokens.accessToken).toBe('signed.jwt.token'); // registration still succeeds
    });
  });

  describe('verifyEmail', () => {
    it('rejects an unknown, already-used, or expired token', async () => {
      mockPrisma.unscoped.emailVerificationToken.findUnique.mockResolvedValueOnce(null);
      await expect(service.verifyEmail('bad-token')).rejects.toThrow(BadRequestException);

      mockPrisma.unscoped.emailVerificationToken.findUnique.mockResolvedValueOnce({
        id: 'evt-1',
        tenantId: TENANT_ID,
        userId: 'user-1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 10_000),
      });
      await expect(service.verifyEmail('used-token')).rejects.toThrow(BadRequestException);

      mockPrisma.unscoped.emailVerificationToken.findUnique.mockResolvedValueOnce({
        id: 'evt-2',
        tenantId: TENANT_ID,
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 10_000),
      });
      await expect(service.verifyEmail('expired-token')).rejects.toThrow(BadRequestException);
    });

    it('marks the email verified and the token used on success', async () => {
      mockPrisma.unscoped.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'evt-3',
        tenantId: TENANT_ID,
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 10_000),
      });

      await service.verifyEmail('good-token');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1', tenantId: TENANT_ID },
        data: { emailVerifiedAt: expect.any(Date) },
      });
      expect(mockPrisma.emailVerificationToken.update).toHaveBeenCalledWith({
        where: { id: 'evt-3', tenantId: TENANT_ID },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  describe('login (tenant slug given)', () => {
    beforeEach(() => {
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: TENANT_ID, slug: TENANT_SLUG, isActive: true, deletedAt: null });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, slug: TENANT_SLUG, name: 'Demo Church' });
    });

    it('throws BadRequestException when the slug does not resolve to a tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        service.login(TENANT_SLUG, { email: 'nobody@church.rw', password: 'whatever1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      mockPrisma.unscoped.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login(TENANT_SLUG, { email: 'nobody@church.rw', password: 'whatever1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);
      mockPrisma.unscoped.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        deletedAt: null,
        passwordHash,
        userRoles: [],
      });

      await expect(
        service.login(TENANT_SLUG, { email: 'pastor@church.rw', password: 'WrongPass1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an inactive user even with the right password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);
      mockPrisma.unscoped.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: false,
        deletedAt: null,
        passwordHash,
        userRoles: [],
      });

      await expect(
        service.login(TENANT_SLUG, { email: 'pastor@church.rw', password: 'CorrectPass1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws the same generic UnauthorizedException for a locked account (never reveals it exists)', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);
      mockPrisma.unscoped.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        deletedAt: null,
        lockedAt: new Date(),
        passwordHash,
        userRoles: [],
      });

      await expect(
        service.login(TENANT_SLUG, { email: 'pastor@church.rw', password: 'CorrectPass1' }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
    });

    it('returns tokens, the resolved tenant, and flattens role permissions on success', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);
      mockPrisma.unscoped.user.findUnique.mockResolvedValueOnce({
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
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', firstName: 'Pastor', lastName: 'John' }); // issueSession's own lookup

      const result = (await service.login(TENANT_SLUG, {
        email: 'pastor@church.rw',
        password: 'CorrectPass1',
      })) as AuthResponseDto;

      expect(result.user.roles).toEqual(['Pastor']);
      expect(result.user.permissions).toEqual(['user.read']); // deduplicated
      expect(result.tenant).toEqual({ slug: TENANT_SLUG, name: 'Demo Church' });
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'auth.login' }) }),
      );
    });

    it('uses the tenant-configured token TTLs instead of the platform defaults when set', async () => {
      mockSecuritySettings.getEffective.mockResolvedValueOnce({
        accessTokenTtlMinutes: 30,
        refreshTokenTtlDays: 14,
        inactivityLogoutMinutes: null,
        maxConcurrentSessions: null,
      });
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);
      mockPrisma.unscoped.user.findUnique.mockResolvedValueOnce({
        id: 'user-1', email: 'pastor@church.rw', isActive: true, deletedAt: null, passwordHash, userRoles: [],
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', firstName: 'Pastor', lastName: 'John' });

      const result = (await service.login(TENANT_SLUG, {
        email: 'pastor@church.rw',
        password: 'CorrectPass1',
      })) as AuthResponseDto;

      expect(result.tokens.expiresIn).toBe(30 * 60);
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lastUsedAt: expect.any(Date) }) }),
      );
    });

    it('revokes the oldest active session to stay within a configured max-concurrent-sessions limit', async () => {
      mockSecuritySettings.getEffective.mockResolvedValueOnce({
        accessTokenTtlMinutes: 15,
        refreshTokenTtlDays: 7,
        inactivityLogoutMinutes: null,
        maxConcurrentSessions: 2,
      });
      mockPrisma.refreshToken.findMany.mockResolvedValueOnce([{ id: 'oldest' }, { id: 'newer' }]); // already at the limit
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);
      mockPrisma.unscoped.user.findUnique.mockResolvedValueOnce({
        id: 'user-1', email: 'pastor@church.rw', isActive: true, deletedAt: null, passwordHash, userRoles: [],
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', firstName: 'Pastor', lastName: 'John' });

      await service.login(TENANT_SLUG, { email: 'pastor@church.rw', password: 'CorrectPass1' });

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, id: { in: ['oldest'] } },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('login (no tenant slug — cross-tenant email routing)', () => {
    it('throws UnauthorizedException when no active account matches the email in any tenant', async () => {
      mockPrisma.unscoped.user.findMany.mockResolvedValue([]);

      await expect(
        service.login(undefined, { email: 'nobody@anywhere.rw', password: 'whatever1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('logs straight in when exactly one tenant has a matching active account', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);
      mockPrisma.unscoped.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          tenantId: TENANT_ID,
          email: 'pastor@church.rw',
          passwordHash,
          tenant: { id: TENANT_ID, slug: TENANT_SLUG, name: 'Demo Church', isActive: true, deletedAt: null },
        },
      ]);
      mockPrisma.unscoped.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'pastor@church.rw',
        isActive: true,
        deletedAt: null,
        passwordHash,
        userRoles: [],
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', firstName: 'Pastor', lastName: 'John' });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, slug: TENANT_SLUG, name: 'Demo Church' });

      const result = (await service.login(undefined, {
        email: 'pastor@church.rw',
        password: 'CorrectPass1',
      })) as AuthResponseDto;

      expect(result.tenant.slug).toBe(TENANT_SLUG);
    });

    it('asks the caller to disambiguate when the same email+password matches more than one tenant', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);
      mockPrisma.unscoped.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          tenantId: 'tenant-1',
          passwordHash,
          tenant: { id: 'tenant-1', slug: 'church-one', name: 'Church One', isActive: true, deletedAt: null },
        },
        {
          id: 'user-2',
          tenantId: 'tenant-2',
          passwordHash,
          tenant: { id: 'tenant-2', slug: 'church-two', name: 'Church Two', isActive: true, deletedAt: null },
        },
      ]);

      const result = (await service.login(undefined, {
        email: 'shared@example.com',
        password: 'CorrectPass1',
      })) as WorkspaceSelectionResponseDto;

      expect(result.requiresWorkspaceSelection).toBe(true);
      expect(result.workspaces).toEqual([
        { slug: 'church-one', name: 'Church One' },
        { slug: 'church-two', name: 'Church Two' },
      ]);
    });

    it('skips accounts belonging to an inactive tenant when routing by email', async () => {
      mockPrisma.unscoped.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          tenantId: 'tenant-1',
          passwordHash: 'irrelevant',
          tenant: { id: 'tenant-1', slug: 'church-one', name: 'Church One', isActive: false, deletedAt: null },
        },
      ]);

      await expect(
        service.login(undefined, { email: 'pastor@church.rw', password: 'whatever1' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('switchTenant', () => {
    it('rejects when the current user cannot be found in the current tenant', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.switchTenant(TENANT_ID, 'user-1', 'other-church')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the target workspace slug does not resolve', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1', isActive: true, email: 'pastor@church.rw' });
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(service.switchTenant(TENANT_ID, 'user-1', 'nonexistent')).rejects.toThrow(BadRequestException);
    });

    it('rejects when this person has no account in the target workspace', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1', isActive: true, email: 'pastor@church.rw' });
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-2', slug: 'other-church', isActive: true, deletedAt: null });
      mockPrisma.unscoped.user.findUnique.mockResolvedValue(null); // no matching email in the target tenant

      await expect(service.switchTenant(TENANT_ID, 'user-1', 'other-church')).rejects.toThrow(ForbiddenException);
    });

    it('issues a fresh session for the target tenant without requiring a password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1', isActive: true, email: 'pastor@church.rw' });
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-2', slug: 'other-church', isActive: true, deletedAt: null });
      mockPrisma.unscoped.user.findUnique.mockResolvedValueOnce({
        id: 'user-2',
        email: 'pastor@church.rw',
        isActive: true,
        deletedAt: null,
        userRoles: [],
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', firstName: 'Pastor', lastName: 'John' });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-2', slug: 'other-church', name: 'Other Church' });

      const result = await service.switchTenant(TENANT_ID, 'user-1', 'other-church');

      expect(result.tenant.slug).toBe('other-church');
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'auth.switch_tenant' }) }),
      );
    });

    it('rejects switching into a workspace where this account is locked', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1', isActive: true, email: 'pastor@church.rw' });
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-2', slug: 'other-church', isActive: true, deletedAt: null });
      mockPrisma.unscoped.user.findUnique.mockResolvedValueOnce({
        id: 'user-2',
        email: 'pastor@church.rw',
        isActive: true,
        deletedAt: null,
        lockedAt: new Date(),
        userRoles: [],
      });

      await expect(service.switchTenant(TENANT_ID, 'user-1', 'other-church')).rejects.toMatchObject({
        response: { code: 'ACCOUNT_LOCKED' },
      });
    });
  });

  describe('listMyWorkspaces', () => {
    it('returns every active tenant this email has an active account in', async () => {
      mockPrisma.unscoped.user.findMany.mockResolvedValue([
        { tenant: { slug: 'church-one', name: 'Church One', isActive: true, deletedAt: null } },
        { tenant: { slug: 'church-two', name: 'Church Two', isActive: true, deletedAt: null } },
        { tenant: { slug: 'inactive-church', name: 'Inactive', isActive: false, deletedAt: null } },
      ]);

      const result = await service.listMyWorkspaces('pastor@church.rw');

      expect(result).toEqual([
        { slug: 'church-one', name: 'Church One' },
        { slug: 'church-two', name: 'Church Two' },
      ]);
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

    it('rejects and revokes a session that has been idle longer than the tenant-configured inactivity window', async () => {
      mockSecuritySettings.getEffective.mockResolvedValueOnce({
        accessTokenTtlMinutes: 15,
        refreshTokenTtlDays: 7,
        inactivityLogoutMinutes: 30,
        maxConcurrentSessions: null,
      });
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        expiresAt: new Date(Date.now() + 100_000),
        lastUsedAt: new Date(Date.now() - 60 * 60_000), // idle for 60 minutes, over the 30-minute limit
        createdAt: new Date(Date.now() - 60 * 60_000),
      });

      await expect(service.refresh(TENANT_ID, 'user-1', 'idle-token')).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({ where: { id: 'rt-1' }, data: { revokedAt: expect.any(Date) } });
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled(); // rejected before ever loading the user
    });

    it('allows rotation when still within the configured inactivity window', async () => {
      mockSecuritySettings.getEffective.mockResolvedValueOnce({
        accessTokenTtlMinutes: 15,
        refreshTokenTtlDays: 7,
        inactivityLogoutMinutes: 30,
        maxConcurrentSessions: null,
      });
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        expiresAt: new Date(Date.now() + 100_000),
        lastUsedAt: new Date(Date.now() - 5 * 60_000), // idle for 5 minutes, within the 30-minute limit
        createdAt: new Date(Date.now() - 5 * 60_000),
      });
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1', isActive: true, userRoles: [] })
        .mockResolvedValueOnce({ id: 'user-1', firstName: 'A', lastName: 'B' });

      await expect(service.refresh(TENANT_ID, 'user-1', 'fresh-token')).resolves.toBeDefined();
    });

    it('never applies max-concurrent-session eviction on a token rotation (only on a real new login)', async () => {
      // refresh() calls getEffective twice — once for its own inactivity check, once again inside
      // issueSession — so this queues the override for both, deliberately using *Once so the shared
      // mock's persistent default (relied on by every other test in this file) is never mutated.
      const overriddenSettings = { accessTokenTtlMinutes: 15, refreshTokenTtlDays: 7, inactivityLogoutMinutes: null, maxConcurrentSessions: 1 };
      mockSecuritySettings.getEffective.mockResolvedValueOnce(overriddenSettings).mockResolvedValueOnce(overriddenSettings);
      mockPrisma.refreshToken.findFirst.mockResolvedValue({ id: 'rt-1', expiresAt: new Date(Date.now() + 100_000) });
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1', isActive: true, userRoles: [] })
        .mockResolvedValueOnce({ id: 'user-1', firstName: 'A', lastName: 'B' });

      await service.refresh(TENANT_ID, 'user-1', 'valid-token');

      expect(mockPrisma.refreshToken.findMany).not.toHaveBeenCalled();
    });

    it('rejects rotating a token for a now-locked account', async () => {
      mockPrisma.refreshToken.findFirst.mockResolvedValue({ id: 'rt-1', expiresAt: new Date(Date.now() + 100_000) });
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', isActive: true, lockedAt: new Date(), userRoles: [] });

      await expect(service.refresh(TENANT_ID, 'user-1', 'valid-token')).rejects.toMatchObject({
        response: { code: 'ACCOUNT_LOCKED' },
      });
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

    beforeEach(() => {
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: TENANT_ID, slug: TENANT_SLUG, isActive: true, deletedAt: null });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, slug: TENANT_SLUG, name: 'Demo Church' });
    });

    it('throws MFA_REQUIRED when no code is provided', async () => {
      mockPrisma.unscoped.user.findUnique.mockResolvedValue(await mfaUser());

      await expect(
        service.login(TENANT_SLUG, { email: 'pastor@church.rw', password: 'CorrectPass1' }),
      ).rejects.toMatchObject({ response: { code: 'MFA_REQUIRED' } });
    });

    it('throws MFA_INVALID when the code is wrong', async () => {
      mockPrisma.unscoped.user.findUnique.mockResolvedValue(await mfaUser());
      mockMfa.verifyToken.mockReturnValue(false);

      await expect(
        service.login(TENANT_SLUG, { email: 'pastor@church.rw', password: 'CorrectPass1', mfaCode: '000000' }),
      ).rejects.toMatchObject({ response: { code: 'MFA_INVALID' } });
    });

    it('succeeds when the code is valid', async () => {
      mockPrisma.unscoped.user.findUnique.mockResolvedValueOnce(await mfaUser());
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', firstName: 'Pastor', lastName: 'John' });
      mockMfa.verifyToken.mockReturnValue(true);

      const result = (await service.login(TENANT_SLUG, {
        email: 'pastor@church.rw',
        password: 'CorrectPass1',
        mfaCode: '123456',
      })) as AuthResponseDto;

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

  describe('forgotPassword', () => {
    it('creates a reset token and dispatches an email for every active account matching the email, across tenants', async () => {
      mockPrisma.unscoped.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          tenantId: 'tenant-1',
          email: 'pastor@church.rw',
          tenant: { id: 'tenant-1', name: 'Demo Church', isActive: true, deletedAt: null },
        },
      ]);
      mockPrisma.passwordResetToken.create.mockResolvedValue({});
      mockNotifications.create.mockResolvedValue({});

      await service.forgotPassword('Pastor@Church.rw');

      expect(mockPrisma.unscoped.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ email: 'pastor@church.rw' }) }),
      );
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1' }) }),
      );
      expect(mockNotifications.create).toHaveBeenCalledWith(
        'tenant-1',
        undefined,
        expect.objectContaining({ channel: 'email', recipient: 'pastor@church.rw' }),
      );
    });

    it('silently does nothing when no account matches — never reveals whether the email exists', async () => {
      mockPrisma.unscoped.user.findMany.mockResolvedValue([]);

      await expect(service.forgotPassword('nobody@church.rw')).resolves.not.toThrow();

      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mockNotifications.create).not.toHaveBeenCalled();
    });

    it('skips accounts belonging to an inactive tenant', async () => {
      mockPrisma.unscoped.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          tenantId: 'tenant-1',
          email: 'pastor@church.rw',
          tenant: { id: 'tenant-1', name: 'Demo Church', isActive: false, deletedAt: null },
        },
      ]);

      await service.forgotPassword('pastor@church.rw');

      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('rejects an unknown, already-used, or expired token', async () => {
      mockPrisma.unscoped.passwordResetToken.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword('bad-token', 'NewPass123')).rejects.toThrow(BadRequestException);

      mockPrisma.unscoped.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-1',
        tenantId: TENANT_ID,
        userId: 'user-1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(service.resetPassword('used-token', 'NewPass123')).rejects.toThrow(BadRequestException);

      mockPrisma.unscoped.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-2',
        tenantId: TENANT_ID,
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      });
      await expect(service.resetPassword('expired-token', 'NewPass123')).rejects.toThrow(BadRequestException);
    });

    it('updates the password, marks the token used, and revokes every refresh token for that user', async () => {
      mockPrisma.unscoped.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-1',
        tenantId: TENANT_ID,
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.passwordResetToken.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.resetPassword('good-token', 'NewPass123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1', tenantId: TENANT_ID } }),
      );
      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'prt-1', tenantId: TENANT_ID },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', tenantId: TENANT_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('listSessions', () => {
    it('returns only active, non-expired sessions, most recent first', async () => {
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-2', userAgent: 'Chrome', ipAddress: '1.2.3.4', createdAt: new Date(), expiresAt: new Date() },
      ]);

      const result = await service.listSessions(TENANT_ID, 'user-1');

      expect(mockPrisma.refreshToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, userId: 'user-1', revokedAt: null, expiresAt: { gt: expect.any(Date) } },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('revokeSession', () => {
    it('rejects when the session does not exist, already revoked, or belongs to a different user/tenant', async () => {
      mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.revokeSession(TENANT_ID, 'user-1', 'rt-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it('revokes the named session', async () => {
      mockPrisma.refreshToken.findFirst.mockResolvedValue({ id: 'rt-1' });

      await service.revokeSession(TENANT_ID, 'user-1', 'rt-1');

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('loginHistory', () => {
    it('queries AuditLog filtered to login-related actions for this user, most recent first', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { id: 'log-1', action: 'auth.login', ipAddress: '1.2.3.4', metadata: null, createdAt: new Date() },
      ]);

      const result = await service.loginHistory(TENANT_ID, 'user-1');

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT_ID,
            userId: 'user-1',
            action: { in: ['auth.login', 'auth.login_failed', 'auth.logout', 'auth.switch_tenant'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('completeLogin (via login) — failed-attempt auditing', () => {
    it('audits a wrong-password attempt with a reason, before rejecting', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: TENANT_ID, isActive: true, deletedAt: null });
      mockPrisma.unscoped.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        deletedAt: null,
        mfaEnabled: false,
        passwordHash: await bcrypt.hash('CorrectPass1', 12),
        userRoles: [],
      });

      await expect(
        service.login(TENANT_SLUG, { email: 'user@test.com', password: 'WrongPass1' } as any),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'auth.login_failed', metadata: { reason: 'invalid_password' } }),
        }),
      );
    });
  });
});
