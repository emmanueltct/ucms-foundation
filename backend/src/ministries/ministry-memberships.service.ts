import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MinistryMembership } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMinistryMembershipDto } from './dto/create-ministry-membership.dto';
import { UpdateMinistryMembershipDto } from './dto/update-ministry-membership.dto';
import { MinistryMembershipQueryDto } from './dto/ministry-membership-query.dto';

/**
 * Volunteer assignments — a Member's role within a Ministry. "Leader" is
 * just a role value here, not a denormalized field on Ministry (contrast
 * with Family.headOfFamilyId): a ministry can have co-leaders.
 */
@Injectable()
export class MinistryMembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateMinistryMembershipDto): Promise<MinistryMembership> {
    await this.assertMinistryExists(tenantId, dto.ministryId);
    await this.assertMemberExists(tenantId, dto.memberId);
    await this.assertNotAlreadyMember(tenantId, dto.ministryId, dto.memberId);

    return this.prisma.ministryMembership.create({
      data: {
        tenantId,
        ministryId: dto.ministryId,
        memberId: dto.memberId,
        role: dto.role ?? 'member',
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : new Date(),
      },
    });
  }

  async findAll(tenantId: string, query: MinistryMembershipQueryDto) {
    const where = {
      tenantId,
      ...(query.ministryId ? { ministryId: query.ministryId } : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.role ? { role: query.role } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.ministryMembership.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { createdAt: 'desc' },
      }),
      this.prisma.ministryMembership.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<MinistryMembership> {
    const membership = await this.prisma.ministryMembership.findFirst({ where: { id, tenantId } });
    if (!membership) {
      throw new NotFoundException({ code: 'MINISTRY_MEMBERSHIP_NOT_FOUND', message: 'Ministry membership not found.' });
    }
    return membership;
  }

  async update(tenantId: string, id: string, dto: UpdateMinistryMembershipDto): Promise<MinistryMembership> {
    await this.findOne(tenantId, id);
    return this.prisma.ministryMembership.update({ where: { id }, data: { role: dto.role, isActive: dto.isActive } });
  }

  /** Deactivates the membership — the row stays for volunteer-history purposes, mirroring Family's non-cascading-delete philosophy. */
  async remove(tenantId: string, id: string): Promise<MinistryMembership> {
    await this.findOne(tenantId, id);
    return this.prisma.ministryMembership.update({ where: { id }, data: { isActive: false } });
  }

  private async assertMinistryExists(tenantId: string, ministryId: string): Promise<void> {
    const ministry = await this.prisma.ministry.findFirst({ where: { id: ministryId, tenantId, deletedAt: null } });
    if (!ministry) throw new NotFoundException({ code: 'MINISTRY_NOT_FOUND', message: 'Ministry not found.' });
  }

  private async assertMemberExists(tenantId: string, memberId: string): Promise<void> {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId, deletedAt: null } });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
  }

  private async assertNotAlreadyMember(tenantId: string, ministryId: string, memberId: string): Promise<void> {
    const existing = await this.prisma.ministryMembership.findFirst({ where: { tenantId, ministryId, memberId } });
    if (existing) {
      throw new ConflictException({
        code: 'MINISTRY_MEMBERSHIP_ALREADY_EXISTS',
        message: 'This member already has a membership record for this ministry.',
      });
    }
  }
}
