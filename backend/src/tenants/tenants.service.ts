import { randomBytes } from 'crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

/**
 * Platform-Admin-only operations. Provisions and manages tenants themselves
 * — distinct from anything running *inside* a tenant's own context.
 */
@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException({ code: 'SLUG_TAKEN', message: `Slug "${dto.slug}" is already in use.` });
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        currency: dto.currency ?? 'RWF',
        language: dto.language ?? 'en',
        timezone: dto.timezone ?? 'Africa/Kigali',
        subscriptionPlan: dto.subscriptionPlan ?? 'free',
      },
    });

    if (!dto.adminEmail) {
      return { tenant, temporaryPassword: null };
    }

    const temporaryPassword = await this.bootstrapAdminUser(tenant.id, dto.adminEmail);
    return { tenant, temporaryPassword };
  }

  /**
   * Provisions the tenant's first "Church Administrator" role + user so the
   * onboarding wizard's "first admin user" step has someone to log in with.
   * Only tenant-scoped permission codes are granted here (module !==
   * "platform") — the global platform.tenant.* codes stay platform-admin-only,
   * unlike the demo seed's role (which intentionally grants every permission
   * for local-dev convenience only).
   */
  private async bootstrapAdminUser(tenantId: string, adminEmail: string): Promise<string> {
    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const tenantPermissions = await this.prisma.permission.findMany({ where: { module: { not: 'platform' } } });
    const adminRole = await this.prisma.role.create({
      data: {
        tenantId,
        name: 'Church Administrator',
        description: 'Full access within this church tenant',
        isSystem: true,
        rolePermissions: { create: tenantPermissions.map((p) => ({ permissionId: p.id })) },
      },
    });

    await this.prisma.user.create({
      data: {
        tenantId,
        email: adminEmail,
        passwordHash,
        firstName: 'Church',
        lastName: 'Administrator',
        userRoles: { create: [{ roleId: adminRole.id }] },
      },
    });

    return temporaryPassword;
  }

  async findAll(query: PaginationQueryDto) {
    const where = query.search
      ? { name: { contains: query.search, mode: 'insensitive' as const }, deletedAt: null }
      : { deletedAt: null };

    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id, deletedAt: null } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Church not found.' });
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data: { isActive: false } });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
