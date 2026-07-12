import { randomBytes } from 'crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LeadershipScopeService } from '../common/leadership-scope/leadership-scope.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly leadershipScope: LeadershipScopeService,
  ) {}

  /**
   * Two ways to reach this: a caller with the tenant-wide `user.create`
   * permission (or a platform admin) may register any user, unrestricted —
   * unchanged from before. A Branch Administrator (holds a Phase 14
   * `LeadershipAppointment` over a branch) with neither may still reach it,
   * but only to register a user INTO a branch they administer — `dto.
   * assignedBranchId` must be set and must name a branch they lead;
   * `UsersController` deliberately has no static `@Permissions()` on this
   * route so both paths can share it, mirroring `assignRoles`'s existing
   * delegated-caller shape.
   */
  async create(tenantId: string, dto: CreateUserDto, caller: AuthenticatedUser) {
    if (!caller.isPlatformAdmin && !caller.permissions.includes('user.create')) {
      if (!dto.assignedBranchId || !(await this.leadershipScope.isLeaderOf(tenantId, caller.userId, 'branch', dto.assignedBranchId))) {
        throw new ForbiddenException({
          code: 'USER_CREATE_FORBIDDEN',
          message: 'You can only register users into a branch you administer.',
        });
      }
    }

    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email.toLowerCase() } },
    });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email already in use for this church.' });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        assignedBranchId: dto.assignedBranchId,
        assignedDepartmentRecordId: dto.assignedDepartmentRecordId,
        departmentRole: dto.departmentRole,
        userCategory: dto.userCategory,
        userRoles: dto.roleIds ? { create: dto.roleIds.map((roleId) => ({ roleId })) } : undefined,
      },
      select: this.publicSelect(),
    });
  }

  async findAll(tenantId: string, query: PaginationQueryDto) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { createdAt: 'desc' },
        select: this.publicSelect(),
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: this.publicSelect(),
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    return user;
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(tenantId, id);
    const { roleIds, ...rest } = dto;

    return this.prisma.user.update({
      where: { id, tenantId },
      data: {
        ...rest,
        ...(roleIds
          ? { userRoles: { deleteMany: {}, create: roleIds.map((roleId) => ({ roleId })) } }
          : {}),
      },
      select: this.publicSelect(),
    });
  }

  /**
   * Two ways to reach this: a caller with the tenant-wide `user.update`
   * permission (or a platform admin) may assign any role to any user,
   * unchanged from before. A Department Leader with no such permission may
   * still reach it — this is the "reuse the existing role-assignment
   * endpoint" delegated path (see design decision) — but only for users
   * within their own department, and only for roles the Denomination Admin
   * marked `isDelegable`. `UsersController` deliberately has no static
   * `@Permissions()` on this route so both paths can share it; this method
   * is where that split actually happens.
   */
  async assignRoles(tenantId: string, id: string, roleIds: string[], caller: AuthenticatedUser) {
    const target = await this.findOne(tenantId, id);

    if (!caller.isPlatformAdmin && !caller.permissions.includes('user.update')) {
      await this.assertDepartmentDelegation(tenantId, caller, target);

      if (roleIds.length > 0) {
        const delegableCount = await this.prisma.role.count({ where: { id: { in: roleIds }, tenantId, isDelegable: true } });
        if (delegableCount !== roleIds.length) {
          throw new ForbiddenException({
            code: 'DEPARTMENT_ROLE_ASSIGNMENT_FORBIDDEN',
            message: 'You can only assign roles your Denomination Admin has marked delegable.',
          });
        }
      }
    }

    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    await this.prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });
    return this.findOne(tenantId, id);
  }

  /**
   * The shared "may this caller manage this target user's account" check
   * behind assignRoles/activate/deactivate/lock/unlock/forcePasswordReset/
   * moveDepartment — a caller with the tenant-wide `user.update` permission
   * (or a platform admin) may manage anyone, unchanged from before; a
   * Department Leader with neither may still reach these actions, but only
   * for staff currently assigned to their own department.
   */
  private async assertDepartmentDelegation(
    tenantId: string,
    caller: AuthenticatedUser,
    target: { assignedDepartmentRecordId: string | null },
  ): Promise<void> {
    const callerRecord = await this.prisma.user.findFirst({
      where: { id: caller.userId, tenantId },
      select: { assignedDepartmentRecordId: true, departmentRole: true },
    });

    if (
      !callerRecord?.assignedDepartmentRecordId ||
      callerRecord.departmentRole !== 'leader' ||
      target.assignedDepartmentRecordId !== callerRecord.assignedDepartmentRecordId
    ) {
      throw new ForbiddenException({
        code: 'DEPARTMENT_ACTION_FORBIDDEN',
        message: 'You can only manage staff within your own department.',
      });
    }
  }

  /**
   * Resolves the target then applies `assertDepartmentDelegation` for any
   * caller without the tenant-wide `user.update` permission — the one-line
   * guard every department-admin-manageable action below shares. `caller` is
   * omitted only for the cross-tenant Platform Admin routes (not themselves
   * a tenant `User`), which stay unrestricted, matching how those routes
   * already behave today.
   */
  private async assertManageable(tenantId: string, caller: AuthenticatedUser | undefined, id: string) {
    const target = await this.findOne(tenantId, id);
    if (caller && !caller.isPlatformAdmin && !caller.permissions.includes('user.update')) {
      await this.assertDepartmentDelegation(tenantId, caller, target);
    }
    return target;
  }

  async deactivate(tenantId: string, id: string, caller?: AuthenticatedUser) {
    await this.assertManageable(tenantId, caller, id);
    return this.prisma.user.update({ where: { id, tenantId }, data: { isActive: false }, select: this.publicSelect() });
  }

  /** Reverses `deactivate`. Also used as "force account activation" (spec requirement) when a user is stuck otherwise. */
  async activate(tenantId: string, id: string, caller?: AuthenticatedUser) {
    await this.assertManageable(tenantId, caller, id);
    return this.prisma.user.update({ where: { id, tenantId }, data: { isActive: true }, select: this.publicSelect() });
  }

  /**
   * Distinct from `deactivate` — a lock is a security hold (suspicious
   * activity, an admin temporarily freezing an account) rather than the
   * business decision `isActive: false` represents; the two are independent
   * and either, both, or neither may apply to a given user. Enforced at the
   * same points `isActive` already is (`AuthService.completeLogin`/`refresh`,
   * `JwtStrategy.validate`) so a lock takes effect on the account's very next
   * use, not just at its next fresh login.
   */
  async lock(tenantId: string, id: string, reason: string | undefined, caller: AuthenticatedUser) {
    await this.assertManageable(tenantId, caller, id);
    const user = await this.prisma.user.update({
      where: { id, tenantId },
      data: { lockedAt: new Date(), lockedReason: reason ?? null },
      select: this.publicSelect(),
    });
    await this.prisma.refreshToken.updateMany({ where: { userId: id, tenantId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record(tenantId, caller.userId, 'user.locked', 'User', id, { metadata: { reason } });
    return user;
  }

  async unlock(tenantId: string, id: string, caller: AuthenticatedUser) {
    await this.assertManageable(tenantId, caller, id);
    const user = await this.prisma.user.update({
      where: { id, tenantId },
      data: { lockedAt: null, lockedReason: null },
      select: this.publicSelect(),
    });
    await this.audit.record(tenantId, caller.userId, 'user.unlocked', 'User', id);
    return user;
  }

  /** Moves a user to a different department (or clears their assignment with `null`) — the delegation guard checks the user's CURRENT department, so a Leader may move staff out of their own department but not reassign someone else's. */
  async moveDepartment(tenantId: string, id: string, departmentRecordId: string | null, caller: AuthenticatedUser) {
    await this.assertManageable(tenantId, caller, id);
    return this.prisma.user.update({
      where: { id, tenantId },
      data: { assignedDepartmentRecordId: departmentRecordId, departmentRole: departmentRecordId ? 'staff' : null },
      select: this.publicSelect(),
    });
  }

  /**
   * Admin override for when self-service email verification isn't working
   * (broken mail gateway, user lost access to the inbox, etc.) — everywhere
   * else `emailVerifiedAt` is only ever set by the token-based flow in
   * AuthService.verifyEmail. Verification itself is informational only (see
   * AuthService's own docs) so this doesn't change what the user can do,
   * only clears the "please verify your email" nudge.
   */
  async forceVerifyEmail(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.user.update({ where: { id, tenantId }, data: { emailVerifiedAt: new Date() }, select: this.publicSelect() });
  }

  /**
   * Admin-forced password reset — generates a fresh one-time temporary
   * password (same convention as `TenantsService.bootstrapAdminUser`'s
   * initial admin password) for when a user is locked out and the
   * self-service forgot-password email flow is unavailable or
   * insufficient (e.g. the church's only admin account is the one that
   * needs resetting). Revokes every active refresh token for this user
   * first, mirroring `AuthService.resetPassword`, so a stale session can't
   * outlive the reset. `caller` is omitted when called cross-tenant by a
   * Platform Admin (not itself a tenant `User`, so neither the delegation
   * guard nor auditing applies), matching how `force-verify-email`/
   * `force-activate` already skip both there.
   */
  async forcePasswordReset(tenantId: string, id: string, caller?: AuthenticatedUser) {
    await this.assertManageable(tenantId, caller, id);
    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.update({ where: { id, tenantId }, data: { passwordHash }, select: this.publicSelect() });
    await this.prisma.refreshToken.updateMany({ where: { userId: id, tenantId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (caller) {
      await this.audit.record(tenantId, caller.userId, 'user.password_force_reset', 'User', id);
    }

    return { user, temporaryPassword };
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.user.update({
      where: { id, tenantId },
      data: { deletedAt: new Date(), isActive: false },
      select: this.publicSelect(),
    });
  }

  /** Never leak passwordHash / mfaSecret over the API. */
  private publicSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      lockedAt: true,
      lockedReason: true,
      mfaEnabled: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      assignedBranchId: true,
      assignedBranch: { select: { id: true, name: true } },
      assignedDepartmentRecordId: true,
      assignedDepartmentRecord: { select: { id: true, title: true } },
      departmentRole: true,
      userCategory: true,
      userRoles: { select: { role: { select: { id: true, name: true } } } },
    };
  }
}
