import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../communication/notifications.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, WorkspaceOptionDto, WorkspaceSelectionResponseDto } from './dto/auth-response.dto';
import { MfaSetupResponseDto } from './dto/mfa-setup-response.dto';
import { MfaService } from './mfa.service';

type UserWithRoles = Prisma.UserGetPayload<{
  include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } };
}>;

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 7;
const PASSWORD_RESET_TTL_MINUTES = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mfa: MfaService,
    private readonly notifications: NotificationsService,
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

  /**
   * When `tenantSlug` is given (the normal case, once a browser/device
   * remembers its last workspace), this behaves exactly as it always has —
   * one tenant, one lookup. When it's omitted, a person only has to
   * remember their email and password: every active tenant is searched for
   * a matching account (`prisma.unscoped` — see PrismaService). Zero
   * matches is the same generic `INVALID_CREDENTIALS` either way (never
   * reveals whether an email exists); exactly one match logs straight in;
   * more than one (the same email+password registered at more than one
   * church) returns a `WorkspaceSelectionResponseDto` instead, so the
   * frontend can ask which workspace and resubmit with `tenantSlug` set —
   * closing the loop back to the normal single-tenant path.
   */
  async login(tenantSlug: string | undefined, dto: LoginDto): Promise<AuthResponseDto | WorkspaceSelectionResponseDto> {
    if (tenantSlug) {
      const tenantId = await this.resolveTenantIdBySlug(tenantSlug);
      const user = await this.findUserWithRoles(tenantId, dto.email);
      return this.completeLogin(tenantId, user, dto);
    }

    const emailMatches = await this.prisma.unscoped.user.findMany({
      where: { email: dto.email.toLowerCase(), isActive: true, deletedAt: null },
      include: { tenant: true },
    });
    const activeMatches = emailMatches.filter((u) => u.tenant.isActive && !u.tenant.deletedAt);

    if (activeMatches.length === 0) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    if (activeMatches.length === 1) {
      const only = activeMatches[0];
      const user = await this.findUserWithRoles(only.tenantId, dto.email);
      return this.completeLogin(only.tenantId, user, dto);
    }

    // The same email exists in more than one workspace — verify the password before disambiguating,
    // so a wrong password never reveals which churches this email is registered at.
    const passwordMatches: typeof activeMatches = [];
    for (const candidate of activeMatches) {
      if (await bcrypt.compare(dto.password, candidate.passwordHash)) passwordMatches.push(candidate);
    }

    if (passwordMatches.length === 0) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    if (passwordMatches.length === 1) {
      const only = passwordMatches[0];
      const user = await this.findUserWithRoles(only.tenantId, dto.email);
      return this.completeLogin(only.tenantId, user, dto);
    }

    const workspaces: WorkspaceOptionDto[] = passwordMatches.map((m) => ({ slug: m.tenant.slug, name: m.tenant.name }));
    return { requiresWorkspaceSelection: true, workspaces };
  }

  /**
   * Switches an already-authenticated session to a different church
   * workspace the same person (matched by email) also has an account in —
   * no password re-entry, since the caller already proved their identity
   * with a valid token for `currentTenantId`.
   */
  async switchTenant(currentTenantId: string, userId: string, targetTenantSlug: string): Promise<AuthResponseDto> {
    const currentUser = await this.prisma.user.findFirst({ where: { id: userId, tenantId: currentTenantId } });
    if (!currentUser || !currentUser.isActive) {
      throw new UnauthorizedException({ code: 'USER_INACTIVE', message: 'Account is inactive.' });
    }

    const targetTenantId = await this.resolveTenantIdBySlug(targetTenantSlug);
    const targetUser = await this.findUserWithRoles(targetTenantId, currentUser.email);
    if (!targetUser || !targetUser.isActive || targetUser.deletedAt) {
      throw new ForbiddenException({ code: 'NOT_A_MEMBER', message: 'You do not have an account in that church workspace.' });
    }

    const roles = targetUser.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(targetUser.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code))),
    );

    await this.prisma.user.update({ where: { id: targetUser.id, tenantId: targetTenantId }, data: { lastLoginAt: new Date() } });
    await this.audit(targetTenantId, targetUser.id, 'auth.switch_tenant', 'User', targetUser.id);

    return this.issueSession(targetTenantId, targetUser.id, targetUser.email, roles, permissions);
  }

  /** Every church workspace this email has an active account in — powers a workspace switcher in the UI. */
  async listMyWorkspaces(email: string): Promise<WorkspaceOptionDto[]> {
    const users = await this.prisma.unscoped.user.findMany({
      where: { email: email.toLowerCase(), isActive: true, deletedAt: null },
      include: { tenant: true },
    });
    return users
      .filter((u) => u.tenant.isActive && !u.tenant.deletedAt)
      .map((u) => ({ slug: u.tenant.slug, name: u.tenant.name }));
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

  /**
   * Always resolves to the same generic outcome regardless of whether the
   * email matched anyone — never confirms or denies an account's existence.
   * A person may not remember which church workspace they registered
   * under, so this looks up every active user with this email across every
   * tenant (`prisma.unscoped`, the one legitimate cross-tenant identity
   * lookup — see PrismaService) and sends a separate reset link for each
   * match, through the existing Communication/queue pipeline.
   */
  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const candidates = await this.prisma.unscoped.user.findMany({
      where: { email: normalizedEmail, isActive: true, deletedAt: null },
      include: { tenant: true },
    });

    for (const user of candidates) {
      if (!user.tenant.isActive || user.tenant.deletedAt) continue;

      const rawToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

      await this.prisma.passwordResetToken.create({
        data: { tenantId: user.tenantId, userId: user.id, tokenHash: this.hashToken(rawToken), expiresAt },
      });

      const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3001');
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

      try {
        await this.notifications.create(user.tenantId, undefined, {
          channel: 'email',
          recipient: user.email,
          subject: `Reset your password — ${user.tenant.name}`,
          body: `Use this link to reset your ${user.tenant.name} password: ${resetUrl}\nThis link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes. If you didn't request this, ignore it.`,
        });
      } catch {
        // A dispatch failure must never surface to the caller — it would leak that this email matched an account.
      }
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await this.prisma.unscoped.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'PASSWORD_RESET_TOKEN_INVALID',
        message: 'This reset link is invalid or has expired.',
      });
    }

    const { tenantId, userId } = resetToken;
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // The tenant is now known (that's what the token resolved) — every call below
    // supplies it explicitly, the same as any other tenant-scoped write.
    await this.prisma.user.update({ where: { id: userId, tenantId }, data: { passwordHash } });
    await this.prisma.passwordResetToken.update({ where: { id: resetToken.id, tenantId }, data: { usedAt: new Date() } });
    await this.prisma.refreshToken.updateMany({ where: { userId, tenantId, revokedAt: null }, data: { revokedAt: new Date() } });

    await this.audit(tenantId, userId, 'auth.password_reset', 'User', userId);
  }

  // --------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------

  /** Mirrors TenantContextMiddleware's own slug resolution + error codes, for the
   *  routes (login, switch-tenant) that resolve a tenant themselves rather than
   *  relying on the middleware (login may have no header at all; switch-tenant's
   *  header names the *current* tenant, not the target one). */
  private async resolveTenantIdBySlug(slug: string): Promise<string> {
    const tenant = await this.prisma.tenant.findFirst({ where: { slug, deletedAt: null } });
    if (!tenant) {
      throw new BadRequestException({ code: 'TENANT_NOT_RESOLVED', message: 'Could not resolve a church (tenant) for this request.' });
    }
    if (!tenant.isActive) {
      throw new ForbiddenException({ code: 'TENANT_INACTIVE', message: 'This church account is inactive. Contact support.' });
    }
    return tenant.id;
  }

  private async findUserWithRoles(tenantId: string, email: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: email.toLowerCase() } },
      include: {
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
      },
    });
  }

  private async completeLogin(tenantId: string, user: UserWithRoles | null, dto: LoginDto): Promise<AuthResponseDto> {
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

    await this.prisma.user.update({ where: { id: user.id, tenantId }, data: { lastLoginAt: new Date() } });
    await this.audit(tenantId, user.id, 'auth.login', 'User', user.id);

    return this.issueSession(tenantId, user.id, user.email, roles, permissions);
  }

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

    const [user, tenant] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId, tenantId } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
    ]);

    return {
      user: {
        id: userId,
        email,
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        roles,
        permissions,
        mfaEnabled: user?.mfaEnabled ?? false,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
      tenant: {
        slug: tenant?.slug ?? '',
        name: tenant?.name ?? '',
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
