import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { MfaSetupResponseDto } from './dto/mfa-setup-response.dto';
import { MfaService } from './mfa.service';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mfa: MfaService,
  ) {}

  async register(tenantId: string, dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email.toLowerCase() } },
    });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email already registered for this church.' });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    await this.audit(tenantId, user.id, 'auth.register', 'User', user.id);

    return this.issueSession(tenantId, user.id, user.email, [], []);
  }

  async login(tenantId: string, dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email.toLowerCase() } },
      include: {
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        throw new UnauthorizedException({ code: 'MFA_REQUIRED', message: 'A 6-digit authenticator code is required.' });
      }
      if (!user.mfaSecret || !(await this.mfa.verifyToken(dto.mfaCode, user.mfaSecret))) {
        throw new UnauthorizedException({ code: 'MFA_INVALID', message: 'Invalid authenticator code.' });
      }
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code))),
    );

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit(tenantId, user.id, 'auth.login', 'User', user.id);

    return this.issueSession(tenantId, user.id, user.email, roles, permissions);
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a brand new
   * access/refresh pair is issued. Rejects if the token is unknown, expired,
   * or already revoked (protects against replay of a stolen token).
   */
  async refresh(tenantId: string, userId: string, presentedToken: string): Promise<AuthResponseDto> {
    const tokenHash = this.hashToken(presentedToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tenantId, userId, tokenHash, revokedAt: null },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'REFRESH_INVALID', message: 'Refresh token is invalid or expired.' });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({ code: 'USER_INACTIVE', message: 'Account is inactive.' });
    }

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code))),
    );

    return this.issueSession(tenantId, user.id, user.email, roles, permissions);
  }

  async logout(tenantId: string, userId: string, presentedToken: string): Promise<void> {
    const tokenHash = this.hashToken(presentedToken);
    await this.prisma.refreshToken.updateMany({
      where: { tenantId, userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit(tenantId, userId, 'auth.logout', 'User', userId);
  }

  /**
   * Generates a new TOTP secret and stores it unenrolled (mfaEnabled stays
   * false) until confirmed via `enableMfa` with a valid code — so a user
   * who abandons setup mid-flow doesn't get locked into an unusable secret.
   */
  async setupMfa(tenantId: string, userId: string, email: string): Promise<MfaSetupResponseDto> {
    const secret = this.mfa.generateSecret();
    await this.prisma.user.update({ where: { id: userId, tenantId }, data: { mfaSecret: secret } });

    const otpAuthUrl = this.mfa.getOtpAuthUrl(email, secret);
    const qrCodeDataUrl = await this.mfa.generateQrCodeDataUrl(otpAuthUrl);

    return { secret, otpAuthUrl, qrCodeDataUrl };
  }

  async enableMfa(tenantId: string, userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user?.mfaSecret || !(await this.mfa.verifyToken(code, user.mfaSecret))) {
      throw new BadRequestException({ code: 'MFA_INVALID', message: 'Invalid authenticator code.' });
    }
    await this.prisma.user.update({ where: { id: userId, tenantId }, data: { mfaEnabled: true } });
    await this.audit(tenantId, userId, 'auth.mfa_enabled', 'User', userId);
  }

  async disableMfa(tenantId: string, userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user?.mfaSecret || !(await this.mfa.verifyToken(code, user.mfaSecret))) {
      throw new BadRequestException({ code: 'MFA_INVALID', message: 'Invalid authenticator code.' });
    }
    await this.prisma.user.update({ where: { id: userId, tenantId }, data: { mfaEnabled: false, mfaSecret: null } });
    await this.audit(tenantId, userId, 'auth.mfa_disabled', 'User', userId);
  }

  async logoutAll(tenantId: string, userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tenantId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit(tenantId, userId, 'auth.logout_all', 'User', userId);
  }

  // --------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------

  private async issueSession(
    tenantId: string,
    userId: string,
    email: string,
    roles: string[],
    permissions: string[],
  ): Promise<AuthResponseDto> {
    const accessToken = this.jwt.sign(
      { sub: userId, tenantId },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshTokenRaw = crypto.randomBytes(48).toString('hex');
    const refreshToken = this.jwt.sign(
      { sub: userId, tenantId, jti: refreshTokenRaw },
      { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        tenantId,
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    return {
      user: {
        id: userId,
        email,
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        roles,
        permissions,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async audit(tenantId: string, userId: string, action: string, entityType: string, entityId: string) {
    await this.prisma.auditLog.create({
      data: { tenantId, userId, action, entityType, entityId },
    });
  }
}
