import { randomBytes } from 'crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
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
  ) {}

  async create(tenantId: string, dto: CreateUserDto) {
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
      await this.assertDelegatedRoleAssignment(tenantId, caller, target, roleIds);
    }

    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    await this.prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });
    return this.findOne(tenantId, id);
  }

  private async assertDelegatedRoleAssignment(
    tenantId: string,
    caller: AuthenticatedUser,
    target: { assignedDepartmentRecordId: string | null },
    roleIds: string[],
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
        code: 'DEPARTMENT_ROLE_ASSIGNMENT_FORBIDDEN',
        message: 'You can only assign roles to staff within your own department.',
      });
    }

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

  async deactivate(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.user.update({ where: { id, tenantId }, data: { isActive: false }, select: this.publicSelect() });
  }

  /** Reverses `deactivate`. Also used as "force account activation" (spec requirement) when a user is stuck otherwise. */
  async activate(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.user.update({ where: { id, tenantId }, data: { isActive: true }, select: this.publicSelect() });
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
   * outlive the reset. `actorUserId` is omitted when called cross-tenant
   * by a Platform Admin (not itself a tenant `User`), matching how
   * `force-verify-email`/`force-activate` already skip auditing there.
   */
  async forcePasswordReset(tenantId: string, id: string, actorUserId?: string) {
    await this.findOne(tenantId, id);
    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.update({ where: { id, tenantId }, data: { passwordHash }, select: this.publicSelect() });
    await this.prisma.refreshToken.updateMany({ where: { userId: id, tenantId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (actorUserId) {
      await this.audit.record(tenantId, actorUserId, 'user.password_force_reset', 'User', id);
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
      mfaEnabled: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      assignedBranchId: true,
      assignedBranch: { select: { id: true, name: true } },
      assignedDepartmentRecordId: true,
      assignedDepartmentRecord: { select: { id: true, title: true } },
      departmentRole: true,
      userRoles: { select: { role: { select: { id: true, name: true } } } },
    };
  }
}
