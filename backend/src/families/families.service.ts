import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Family } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

/**
 * Family/household management — a flat grouping of Members (see
 * docs/member-management/business-analysis.md). Unlike Branch, a family has
 * no self-reference and deactivating/deleting one never cascades to its
 * members; it's a label they point to, not a structure they belong to.
 */
@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateFamilyDto): Promise<Family> {
    return this.prisma.family.create({
      data: { tenantId, name: dto.name, address: dto.address, phone: dto.phone, notes: dto.notes },
    });
  }

  async findAll(tenantId: string, query: PaginationQueryDto) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.family.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { name: 'asc' },
      }),
      this.prisma.family.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<Family> {
    const family = await this.prisma.family.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!family) throw new NotFoundException({ code: 'FAMILY_NOT_FOUND', message: 'Family not found.' });
    return family;
  }

  /** Members currently pointing at this family — not a stored list, just a reverse lookup. */
  async findMembers(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.member.findMany({
      where: { tenantId, familyId: id, deletedAt: null },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async update(tenantId: string, id: string, dto: UpdateFamilyDto): Promise<Family> {
    await this.findOne(tenantId, id);
    return this.prisma.family.update({
      where: { id },
      data: { name: dto.name, address: dto.address, phone: dto.phone, notes: dto.notes },
    });
  }

  /** Sets or clears the head of family; the target member must already belong to this family (FR-MM-3.2). */
  async setHead(tenantId: string, id: string, memberId: string | null | undefined): Promise<Family> {
    await this.findOne(tenantId, id);

    if (memberId) {
      const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId, deletedAt: null } });
      if (!member || member.familyId !== id) {
        throw new BadRequestException({
          code: 'MEMBER_NOT_IN_FAMILY',
          message: 'That member does not currently belong to this family.',
        });
      }
    }

    return this.prisma.family.update({ where: { id }, data: { headOfFamilyId: memberId ?? null } });
  }

  /** Soft-deletes the family only — members keep their historical familyId (FR-MM-3.4). */
  async softDelete(tenantId: string, id: string): Promise<Family> {
    await this.findOne(tenantId, id);
    return this.prisma.family.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Clears headOfFamilyId if it currently points at the given member — called by MembersService (FR-MM-3.3). */
  async clearHeadIfMember(tenantId: string, memberId: string): Promise<void> {
    await this.prisma.family.updateMany({ where: { tenantId, headOfFamilyId: memberId }, data: { headOfFamilyId: null } });
  }
}
