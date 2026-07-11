import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ResourceAssignment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResourceAssignmentDto } from './dto/create-resource-assignment.dto';
import { ResourceAssignmentQueryDto } from './dto/resource-assignment-query.dto';

/**
 * The single generic mechanism attaching a resource (module/report/
 * dashboard/workflow/document category) to an organizational scope (a
 * Branch, a branch_type ConfigItem, a Dynamic Module Record, ...) — see the
 * model comment in schema.prisma. Departments (Phase 6) and Department
 * Leader scoping (Phase 7) both build on `resolveForScope` rather than
 * inventing their own attachment tables.
 */
@Injectable()
export class ResourceAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateResourceAssignmentDto): Promise<ResourceAssignment> {
    const existing = await this.prisma.resourceAssignment.findUnique({
      where: {
        tenantId_scopeEntityType_scopeEntityId_resourceType_resourceKey: {
          tenantId,
          scopeEntityType: dto.scopeEntityType,
          scopeEntityId: dto.scopeEntityId,
          resourceType: dto.resourceType,
          resourceKey: dto.resourceKey,
        },
      },
    });
    if (existing) {
      throw new ConflictException({ code: 'RESOURCE_ASSIGNMENT_ALREADY_EXISTS', message: 'This resource is already assigned to this scope.' });
    }
    return this.prisma.resourceAssignment.create({ data: { tenantId, ...dto } });
  }

  async findAll(tenantId: string, query: ResourceAssignmentQueryDto): Promise<ResourceAssignment[]> {
    return this.prisma.resourceAssignment.findMany({
      where: {
        tenantId,
        ...(query.scopeEntityType ? { scopeEntityType: query.scopeEntityType } : {}),
        ...(query.scopeEntityId ? { scopeEntityId: query.scopeEntityId } : {}),
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      },
      orderBy: [{ resourceType: 'asc' }, { resourceKey: 'asc' }],
    });
  }

  /** Centralized resolver — "everything assigned to this one scope entity," the shape Departments/Department-Leader scoping build on. */
  async resolveForScope(tenantId: string, scopeEntityType: string, scopeEntityId: string): Promise<ResourceAssignment[]> {
    return this.prisma.resourceAssignment.findMany({
      where: { tenantId, scopeEntityType, scopeEntityId },
      orderBy: [{ resourceType: 'asc' }, { resourceKey: 'asc' }],
    });
  }

  async remove(tenantId: string, id: string): Promise<{ id: string }> {
    const existing = await this.prisma.resourceAssignment.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException({ code: 'RESOURCE_ASSIGNMENT_NOT_FOUND', message: 'Resource assignment not found.' });
    await this.prisma.resourceAssignment.delete({ where: { id } });
    return { id };
  }
}
