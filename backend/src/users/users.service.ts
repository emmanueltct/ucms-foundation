import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async assignRoles(tenantId: string, id: string, roleIds: string[]) {
    await this.findOne(tenantId, id);
    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    await this.prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });
    return this.findOne(tenantId, id);
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
      userRoles: { select: { role: { select: { id: true, name: true } } } },
    };
  }
}
