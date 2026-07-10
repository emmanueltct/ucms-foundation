import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Ministry } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';
import { MinistryQueryDto } from './dto/ministry-query.dto';
import { resolveBranchFilterIncludingChurchWide } from '../common/branch-scope/branch-visibility.util';

/**
 * Ministry & Volunteer Management — see docs/ministry/business-analysis.md.
 * A ministry is a flat entity (no self-reference, unlike Branch) that may
 * optionally scope to one Branch or stay church-wide.
 */
@Injectable()
export class MinistriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateMinistryDto): Promise<Ministry> {
    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }
    await this.assertNameFree(tenantId, dto.name);

    return this.prisma.ministry.create({
      data: {
        tenantId,
        branchId: dto.branchId ?? null,
        name: dto.name,
        ministryType: dto.ministryType,
        description: dto.description,
      },
    });
  }

  async findAll(tenantId: string, query: MinistryQueryDto, visibleBranchIds: string[] | null = null) {
    const where = {
      tenantId,
      deletedAt: null,
      ...resolveBranchFilterIncludingChurchWide(query.branchId, visibleBranchIds),
      ...(query.ministryType ? { ministryType: query.ministryType } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.ministry.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { name: 'asc' },
      }),
      this.prisma.ministry.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<Ministry> {
    const ministry = await this.prisma.ministry.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!ministry) throw new NotFoundException({ code: 'MINISTRY_NOT_FOUND', message: 'Ministry not found.' });
    return ministry;
  }

  async update(tenantId: string, id: string, dto: UpdateMinistryDto): Promise<Ministry> {
    const existing = await this.findOne(tenantId, id);

    if (dto.branchId && dto.branchId !== existing.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }
    if (dto.name && dto.name !== existing.name) {
      await this.assertNameFree(tenantId, dto.name);
    }

    return this.prisma.ministry.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        name: dto.name,
        ministryType: dto.ministryType,
        description: dto.description,
      },
    });
  }

  /** Soft-deletes the ministry and deactivates every membership, preserving volunteer history. */
  async softDelete(tenantId: string, id: string): Promise<Ministry> {
    await this.findOne(tenantId, id);
    await this.prisma.ministryMembership.updateMany({ where: { tenantId, ministryId: id }, data: { isActive: false } });
    return this.prisma.ministry.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  private async assertBranchExists(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
  }

  private async assertNameFree(tenantId: string, name: string): Promise<void> {
    const existing = await this.prisma.ministry.findFirst({ where: { tenantId, name, deletedAt: null } });
    if (existing) {
      throw new ConflictException({ code: 'MINISTRY_NAME_TAKEN', message: `A ministry named "${name}" already exists.` });
    }
  }
}
