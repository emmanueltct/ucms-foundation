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
import { AuditService } from '../audit/audit.service';
import { SecuritySettingsService } from '../security-settings/security-settings.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, WorkspaceOptionDto, WorkspaceSelectionResponseDto } from './dto/auth-response.dto';
import { MfaSetupResponseDto } from './dto/mfa-setup-response.dto';
import { MfaService } from './mfa.service';

type UserWithRoles = Prisma.UserGetPayload<{
  include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } };
}>;

/** Captured from the request at the auth controller and threaded through to `issueSession`/`audit` — never trusted beyond "what this HTTP request reported." */
export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

const LOGIN_HISTORY_ACTIONS = ['auth.login', 'auth.login_failed', 'auth.logout', 'auth.switch_tenant'];
const LOGIN_HISTORY_LIMIT = 50;

const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_TTL_MINUTES = 30;
const EMAIL_VERIFICATION_TTL_HOURS = 48;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mfa: MfaService,
    private readonly notifications: NotificationsService,
    private readonly auditService: AuditService,
    private readonly securitySettings: SecuritySettingsService,
  ) {}

  async register(tenantId: string, dto: RegisterDto, context: SessionContext = {}): Promise<AuthResponseDto> {
    // .unscoped for the same reason as findUserWithRoles below — a compound
    // unique key (tenantId_email) isn't recognized by the tenant-scoping
    // extension's flat `where.tenantId` check, so this must supply tenantId
    // explicitly rather than depend on an active tenant context existing.
    const existing = await this.prisma.unscoped.user.findUnique({
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

    // Verification is a soft nudge, not a gate — a dispatch failure must never block registration itself.
    try {
      await this.sendVerificationEmail(tenantId, user.id, user.email);
    } catch {
      // documented stub gateway; see Communication module
    }

    return this.issueSession(tenantId, user.id, user.email, [], [], context);
  }

  /**
   * Not enforced anywhere today — `emailVerifiedAt` is informational only,
   * shown back to the user, and login/permissions never check it. This is
   * a deliberate scope decision (see docs/business-analysis.md):
   * gating login on verification is a real, separate feature (what happens
   * to an unverified account after N days? does an admin need to see who's
   * unverified?) that nothing in the current requirement calls for yet.
   */
  async sendVerificationEmail(tenantId: string, userId: string, email: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.emailVerificationToken.create({
      data: { tenantId, userId, tokenHash: this.hashToken(rawToken), expiresAt },
    });

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3001');
    const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`;

    await this.notifications.create(tenantId, undefined, {
      channel: 'email',
      recipient: email,
      subject: `Verify your email — ${tenant.name}`,
      body: `Confirm this is your email address for ${tenant.name}: ${verifyUrl}\nThis link expires in ${EMAIL_VERIFICATION_TTL_HOURS} hours.`,
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const verificationToken = await this.prisma.unscoped.emailVerificationToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });

    if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'EMAIL_VERIFICATION_TOKEN_INVALID',
        message: 'This verification link is invalid or has expired.',
      });
    }

    const { tenantId, userId } = verificationToken;
    await this.prisma.user.update({ where: { id: userId, tenantId }, data: { emailVerifiedAt: new Date() } });
    await this.prisma.emailVerificationToken.update({
      where: { id: verificationToken.id, tenantId },
      data: { usedAt: new Date() },
    });
    await this.audit(tenantId, userId, 'auth.email_verified', 'User', userId);
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
  async login(
    tenantSlug: string | undefined,
    dto: LoginDto,
    context: SessionContext = {},
  ): Promise<AuthResponseDto | WorkspaceSelectionResponseDto> {
    if (tenantSlug) {
      const tenantId = await this.resolveTenantIdBySlug(tenantSlug);
      const user = await this.findUserWithRoles(tenantId, dto.email);
      return this.completeLogin(tenantId, user, dto, context);
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
      return this.completeLogin(only.tenantId, user, dto, context);
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
      return this.completeLogin(only.tenantId, user, dto, context);
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
  async switchTenant(
    currentTenantId: string,
    userId: string,
    targetTenantSlug: string,
    context: SessionContext = {},
  ): Promise<AuthResponseDto> {
    const currentUser = await this.prisma.user.findFirst({ where: { id: userId, tenantId: currentTenantId } });
    if (!currentUser || !currentUser.isActive) {
      throw new UnauthorizedException({ code: 'USER_INACTIVE', message: 'Account is inactive.' });
    }

    const targetTenantId = await this.resolveTenantIdBySlug(targetTenantSlug);
    const targetUser = await this.findUserWithRoles(targetTenantId, currentUser.email);
    if (!targetUser || !targetUser.isActive || targetUser.deletedAt) {
      throw new ForbiddenException({ code: 'NOT_A_MEMBER', message: 'You do not have an account in that church workspace.' });
    }
    if (targetUser.lockedAt) {
      throw new ForbiddenException({ code: 'ACCOUNT_LOCKED', message: 'That account is locked.' });
    }

    const roles = targetUser.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(targetUser.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code))),
    );

    await this.prisma.user.update({ where: { id: targetUser.id, tenantId: targetTenantId }, data: { lastLoginAt: new Date() } });
    await this.audit(targetTenantId, targetUser.id, 'auth.switch_tenant', 'User', targetUser.id, context);

    return this.issueSession(targetTenantId, targetUser.id, targetUser.email, roles, permissions, context);
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
  async refresh(
    tenantId: string,
    userId: string,
    presentedToken: string,
    context: SessionContext = {},
  ): Promise<AuthResponseDto> {
    const tokenHash = this.hashToken(presentedToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tenantId, userId, tokenHash, revokedAt: null },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'REFRESH_INVALID', message: 'Refresh token is invalid or expired.' });
    }

    // Inactivity auto-logout (§1 Session Security Configuration): measured
    // against this session's last actual use, not its original login time —
    // a session that keeps refreshing regularly never triggers this, only
    // one that's gone quiet longer than the tenant's configured window.
    const { inactivityLogoutMinutes } = await this.securitySettings.getEffective(tenantId);
    if (inactivityLogoutMinutes) {
      const lastActivity = stored.lastUsedAt ?? stored.createdAt;
      const idleMinutes = (Date.now() - lastActivity.getTime()) / 60_000;
      if (idleMinutes > inactivityLogoutMinutes) {
        await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
        throw new UnauthorizedException({ code: 'SESSION_EXPIRED_INACTIVITY', message: 'Signed out after a period of inactivity.' });
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, tenantId },
      include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({ code: 'USER_INACTIVE', message: 'Account is inactive.' });
    }
    if (user.lockedAt) {
      throw new UnauthorizedException({ code: 'ACCOUNT_LOCKED', message: 'This account is locked.' });
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code))),
    );

    // Reuses the device/IP the rotating request actually reported, so a
    // session's identity in `GET /auth/sessions` stays accurate across
    // rotations rather than freezing at whatever the original login saw.
    // `enforceMaxConcurrent: false` — this is a 1-for-1 rotation of the same
    // session, never a net-new login, so it must never count against (or
    // evict another session to make room under) the concurrency limit.
    const result = await this.issueSession(tenantId, user.id, user.email, roles, permissions, context, { enforceMaxConcurrent: false });
    const newTokenHash = this.hashToken(result.tokens.refreshToken);
    const newToken = await this.prisma.refreshToken.findFirst({ where: { tenantId, userId, tokenHash: newTokenHash } });

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: newToken?.id },
    });

    return result;
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
    // .unscoped — this runs during login, before any tenant context is
    // guaranteed active (auth/login is excluded from TenantContextMiddleware
    // precisely so it can resolve the tenant itself). tenantId is already an
    // explicit, caller-supplied filter here, so this is exactly the
    // "cross-tenant identity lookup" case PrismaService.unscoped exists for.
    return this.prisma.unscoped.user.findUnique({
      where: { tenantId_email: { tenantId, email: email.toLowerCase() } },
      include: {
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
      },
    });
  }

  private async completeLogin(
    tenantId: string,
    user: UserWithRoles | null,
    dto: LoginDto,
    context: SessionContext = {},
  ): Promise<AuthResponseDto> {
    // Locked is folded into the same generic INVALID_CREDENTIALS as
    // inactive/deleted (not a distinct ACCOUNT_LOCKED code) for the same
    // reason those are generic here: an unauthenticated login attempt must
    // never reveal that an account exists in a particular state. Contrast
    // with `refresh`/`switchTenant`, where the caller already holds a valid
    // token proving prior authentication, so being specific there leaks nothing.
    if (!user || !user.isActive || user.deletedAt || user.lockedAt) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.audit(tenantId, user.id, 'auth.login_failed', 'User', user.id, context, { reason: 'invalid_password' });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        throw new UnauthorizedException({ code: 'MFA_REQUIRED', message: 'A 6-digit authenticator code is required.' });
      }
      if (!user.mfaSecret || !(await this.mfa.verifyToken(dto.mfaCode, user.mfaSecret))) {
        await this.audit(tenantId, user.id, 'auth.login_failed', 'User', user.id, context, { reason: 'invalid_mfa_code' });
        throw new UnauthorizedException({ code: 'MFA_INVALID', message: 'Invalid authenticator code.' });
      }
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code))),
    );

    await this.prisma.user.update({ where: { id: user.id, tenantId }, data: { lastLoginAt: new Date() } });
    await this.audit(tenantId, user.id, 'auth.login', 'User', user.id, context);

    return this.issueSession(tenantId, user.id, user.email, roles, permissions, context);
  }

  private async issueSession(
    tenantId: string,
    userId: string,
    email: string,
    roles: string[],
    permissions: string[],
    context: SessionContext = {},
    options: { enforceMaxConcurrent?: boolean } = {},
  ): Promise<AuthResponseDto> {
    const { enforceMaxConcurrent = true } = options;
    const settings = await this.securitySettings.getEffective(tenantId);

    if (enforceMaxConcurrent && settings.maxConcurrentSessions) {
      const active = await this.prisma.refreshToken.findMany({
        where: { tenantId, userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      // Signing in again is never blocked — the oldest sessions are silently
      // retired to make room, the least surprising outcome for a user who
      // just wants to log in on a new device.
      const overflow = active.length - (settings.maxConcurrentSessions - 1);
      if (overflow > 0) {
        const idsToRevoke = active.slice(0, overflow).map((t) => t.id);
        await this.prisma.refreshToken.updateMany({ where: { tenantId, id: { in: idsToRevoke } }, data: { revokedAt: new Date() } });
      }
    }

    const accessToken = this.jwt.sign(
      { sub: userId, tenantId },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: `${settings.accessTokenTtlMinutes}m` },
    );

    const refreshTokenRaw = crypto.randomBytes(48).toString('hex');
    const refreshToken = this.jwt.sign(
      { sub: userId, tenantId, jti: refreshTokenRaw },
      { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: `${settings.refreshTokenTtlDays}d` },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + settings.refreshTokenTtlDays);

    await this.prisma.refreshToken.create({
      data: {
        tenantId,
        userId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt,
        lastUsedAt: new Date(),
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
        emailVerifiedAt: user?.emailVerifiedAt?.toISOString() ?? null,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: settings.accessTokenTtlMinutes * 60,
      },
      tenant: {
        slug: tenant?.slug ?? '',
        name: tenant?.name ?? '',
      },
    };
  }

  /** Active (non-revoked, non-expired) device sessions for the current user — powers a "sign out this device" UI. */
  async listSessions(tenantId: string, userId: string) {
    return this.prisma.refreshToken.findMany({
      where: { tenantId, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Revokes one specific session by id — the device-management counterpart to `logout` (which needs the token itself) and `logoutAll` (which revokes every session). */
  async revokeSession(tenantId: string, userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, tenantId, userId, revokedAt: null },
    });
    if (!session) {
      throw new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'Session not found.' });
    }
    await this.prisma.refreshToken.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }

  /** Recent login-related activity for the current user — reuses AuditLog rather than a dedicated table (see FR-AUTH-9). */
  async loginHistory(tenantId: string, userId: string) {
    return this.prisma.auditLog.findMany({
      where: { tenantId, userId, action: { in: LOGIN_HISTORY_ACTIONS } },
      select: { id: true, action: true, ipAddress: true, metadata: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: LOGIN_HISTORY_LIMIT,
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Thin wrapper kept so none of this file's ~11 call sites had to change — delegates to the shared, injectable `AuditService` (backend/src/audit/audit.service.ts). */
  private async audit(
    tenantId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    context: SessionContext = {},
    extraMetadata?: Record<string, unknown>,
  ) {
    await this.auditService.record(tenantId, userId, action, entityType, entityId, {
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: extraMetadata,
    });
  }
}
