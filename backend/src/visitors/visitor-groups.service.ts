import { Injectable, NotFoundException } from '@nestjs/common';
import { Visitor, VisitorGroup, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitorGroupDto } from './dto/create-visitor-group.dto';
import { UpdateVisitorGroupDto } from './dto/update-visitor-group.dto';
import { VisitorGroupQueryDto } from './dto/visitor-group-query.dto';

/**
 * A delegation, family, choir/youth visit, conference party, or mission
 * team — see docs/visitor-management/business-analysis.md. Individual
 * members are still plain `Visitor` rows (`visitorGroupId` set), so
 * everything Visitors already does (follow-up status, conversion to a
 * Member) keeps working per-person even when they arrived as a group.
 */
@Injectable()
export class VisitorGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateVisitorGroupDto): Promise<VisitorGroup> {
    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }
    return this.prisma.visitorGroup.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        name: dto.name,
        groupType: dto.groupType,
        visitDate: new Date(dto.visitDate),
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        expectedSize: dto.expectedSize,
        source: dto.source,
        assignedToUserId: dto.assignedToUserId,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: VisitorGroupQueryDto) {
    const where = this.buildWhere(tenantId, query);

    const [items, total] = await Promise.all([
      this.prisma.visitorGroup.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { visitDate: 'desc' },
      }),
      this.prisma.visitorGroup.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<VisitorGroup> {
    return this.findOneRaw(tenantId, id);
  }

  async update(tenantId: string, id: string, dto: UpdateVisitorGroupDto): Promise<VisitorGroup> {
    await this.findOneRaw(tenantId, id);
    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }

    return this.prisma.visitorGroup.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        name: dto.name,
        groupType: dto.groupType,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        expectedSize: dto.expectedSize,
        source: dto.source,
        assignedToUserId: dto.assignedToUserId,
        status: dto.status,
        notes: dto.notes,
      },
    });
  }

  async softDelete(tenantId: string, id: string): Promise<VisitorGroup> {
    await this.findOneRaw(tenantId, id);
    return this.prisma.visitorGroup.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  async listMembers(tenantId: string, id: string): Promise<Visitor[]> {
    await this.findOneRaw(tenantId, id);
    return this.prisma.visitor.findMany({
      where: { tenantId, visitorGroupId: id, deletedAt: null },
      orderBy: { firstName: 'asc' },
    });
  }

  private async findOneRaw(tenantId: string, id: string): Promise<VisitorGroup> {
    const group = await this.prisma.visitorGroup.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!group) throw new NotFoundException({ code: 'VISITOR_GROUP_NOT_FOUND', message: 'Visitor group not found.' });
    return group;
  }

  private buildWhere(tenantId: string, query: VisitorGroupQueryDto): Prisma.VisitorGroupWhereInput {
    return {
      tenantId,
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.groupType ? { groupType: query.groupType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { contactName: { contains: query.search, mode: 'insensitive' as const } },
              { contactPhone: { contains: query.search, mode: 'insensitive' as const } },
              { contactEmail: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  private async assertBranchExists(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
  }
}
