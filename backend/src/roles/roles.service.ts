import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { tenantId_name: { tenantId, name: dto.name } } });
    if (existing) {
      throw new ConflictException({ code: 'ROLE_NAME_TAKEN', message: `Role "${dto.name}" already exists.` });
    }

    const permissionIds = await this.resolvePermissionIds(dto.permissionCodes ?? []);

    return this.prisma.role.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        isDelegable: dto.isDelegable ?? false,
        rolePermissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role not found.' });
    return role;
  }

  async update(tenantId: string, id: string, dto: UpdateRoleDto) {
    const role = await this.findOne(tenantId, id);
    if (role.isSystem) {
      throw new ForbiddenException({ code: 'SYSTEM_ROLE_LOCKED', message: 'System roles cannot be modified.' });
    }

    const permissionIds = dto.permissionCodes ? await this.resolvePermissionIds(dto.permissionCodes) : undefined;

    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isDelegable: dto.isDelegable,
        ...(permissionIds
          ? { rolePermissions: { deleteMany: {}, create: permissionIds.map((permissionId) => ({ permissionId })) } }
          : {}),
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async remove(tenantId: string, id: string) {
    const role = await this.findOne(tenantId, id);
    if (role.isSystem) {
      throw new ForbiddenException({ code: 'SYSTEM_ROLE_LOCKED', message: 'System roles cannot be deleted.' });
    }
    await this.prisma.role.delete({ where: { id } });
    return { id };
  }

  private async resolvePermissionIds(codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const permissions = await this.prisma.permission.findMany({ where: { code: { in: codes } } });
    if (permissions.length !== codes.length) {
      const found = new Set(permissions.map((p) => p.code));
      const missing = codes.filter((c) => !found.has(c));
      throw new BadRequestException({ code: 'UNKNOWN_PERMISSION', message: `Unknown permission codes: ${missing.join(', ')}` });
    }
    return permissions.map((p) => p.id);
  }
}
