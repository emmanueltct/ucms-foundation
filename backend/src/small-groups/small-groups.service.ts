import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SmallGroup } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSmallGroupDto } from './dto/create-small-group.dto';
import { UpdateSmallGroupDto } from './dto/update-small-group.dto';
import { SmallGroupQueryDto } from './dto/small-group-query.dto';

/**
 * Small Groups & Children's Ministry — see docs/small-groups/business-analysis.md.
 * Structurally mirrors Ministry & Volunteer Management (flat, optionally
 * branch-scoped, unique name per tenant) but is a distinct module: this is
 * discipleship/fellowship structure, not volunteer serving assignments, and
 * carries scheduling/capacity/age-range fields a ministry has no use for.
 */
@Injectable()
export class SmallGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateSmallGroupDto): Promise<SmallGroup> {
    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }
    await this.assertNameFree(tenantId, dto.name);
    this.assertValidAgeRange(dto.minAge, dto.maxAge);

    return this.prisma.smallGroup.create({
      data: {
        tenantId,
        branchId: dto.branchId ?? null,
        name: dto.name,
        groupType: dto.groupType,
        description: dto.description,
        meetingDay: dto.meetingDay,
        meetingTime: dto.meetingTime,
        location: dto.location,
        capacity: dto.capacity,
        minAge: dto.minAge,
        maxAge: dto.maxAge,
      },
    });
  }

  async findAll(tenantId: string, query: SmallGroupQueryDto) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.groupType ? { groupType: query.groupType } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.smallGroup.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { name: 'asc' },
      }),
      this.prisma.smallGroup.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<SmallGroup> {
    const group = await this.prisma.smallGroup.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!group) throw new NotFoundException({ code: 'SMALL_GROUP_NOT_FOUND', message: 'Small group not found.' });
    return group;
  }

  async update(tenantId: string, id: string, dto: UpdateSmallGroupDto): Promise<SmallGroup> {
    const existing = await this.findOne(tenantId, id);

    if (dto.branchId && dto.branchId !== existing.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }
    if (dto.name && dto.name !== existing.name) {
      await this.assertNameFree(tenantId, dto.name);
    }
    this.assertValidAgeRange(dto.minAge ?? existing.minAge ?? undefined, dto.maxAge ?? existing.maxAge ?? undefined);

    return this.prisma.smallGroup.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        name: dto.name,
        groupType: dto.groupType,
        description: dto.description,
        meetingDay: dto.meetingDay,
        meetingTime: dto.meetingTime,
        location: dto.location,
        capacity: dto.capacity,
        minAge: dto.minAge,
        maxAge: dto.maxAge,
      },
    });
  }

  /** Soft-deletes the group and deactivates every membership, preserving roster history. */
  async softDelete(tenantId: string, id: string): Promise<SmallGroup> {
    await this.findOne(tenantId, id);
    await this.prisma.smallGroupMembership.updateMany({ where: { tenantId, smallGroupId: id }, data: { isActive: false } });
    return this.prisma.smallGroup.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  private assertValidAgeRange(minAge: number | undefined, maxAge: number | undefined): void {
    if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
      throw new BadRequestException({
        code: 'SMALL_GROUP_INVALID_AGE_RANGE',
        message: 'minAge cannot be greater than maxAge.',
      });
    }
  }

  private async assertBranchExists(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
  }

  private async assertNameFree(tenantId: string, name: string): Promise<void> {
    const existing = await this.prisma.smallGroup.findFirst({ where: { tenantId, name, deletedAt: null } });
    if (existing) {
      throw new ConflictException({ code: 'SMALL_GROUP_NAME_TAKEN', message: `A small group named "${name}" already exists.` });
    }
  }
}
