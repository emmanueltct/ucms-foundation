import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SmallGroupMembership } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSmallGroupMembershipDto } from './dto/create-small-group-membership.dto';
import { UpdateSmallGroupMembershipDto } from './dto/update-small-group-membership.dto';
import { SmallGroupMembershipQueryDto } from './dto/small-group-membership-query.dto';

/**
 * Roster assignments — a Member's participation in a SmallGroup. "Leader"
 * and "co_leader" are role values, not denormalized fields on SmallGroup,
 * the same reasoning MinistryMembership already established. Capacity is
 * enforced here the same way EventRegistration enforces Event.capacity: a
 * soft cap checked at creation time, not a hard schema constraint.
 */
@Injectable()
export class SmallGroupMembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateSmallGroupMembershipDto): Promise<SmallGroupMembership> {
    const smallGroup = await this.assertSmallGroupExists(tenantId, dto.smallGroupId);
    await this.assertMemberExists(tenantId, dto.memberId);
    await this.assertNotAlreadyMember(tenantId, dto.smallGroupId, dto.memberId);

    if (smallGroup.capacity !== null) {
      const activeCount = await this.prisma.smallGroupMembership.count({
        where: { tenantId, smallGroupId: dto.smallGroupId, isActive: true },
      });
      if (activeCount >= smallGroup.capacity) {
        throw new ConflictException({ code: 'SMALL_GROUP_FULL', message: 'This small group has reached its capacity.' });
      }
    }

    return this.prisma.smallGroupMembership.create({
      data: {
        tenantId,
        smallGroupId: dto.smallGroupId,
        memberId: dto.memberId,
        role: dto.role ?? 'member',
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : new Date(),
      },
    });
  }

  async findAll(tenantId: string, query: SmallGroupMembershipQueryDto) {
    const where = {
      tenantId,
      ...(query.smallGroupId ? { smallGroupId: query.smallGroupId } : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.role ? { role: query.role } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.smallGroupMembership.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { createdAt: 'desc' },
      }),
      this.prisma.smallGroupMembership.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<SmallGroupMembership> {
    const membership = await this.prisma.smallGroupMembership.findFirst({ where: { id, tenantId } });
    if (!membership) {
      throw new NotFoundException({ code: 'SMALL_GROUP_MEMBERSHIP_NOT_FOUND', message: 'Small group membership not found.' });
    }
    return membership;
  }

  async update(tenantId: string, id: string, dto: UpdateSmallGroupMembershipDto): Promise<SmallGroupMembership> {
    await this.findOne(tenantId, id);
    return this.prisma.smallGroupMembership.update({ where: { id }, data: { role: dto.role, isActive: dto.isActive } });
  }

  /** Deactivates the membership — the row stays for roster-history purposes, mirroring Ministry's non-cascading-delete philosophy. */
  async remove(tenantId: string, id: string): Promise<SmallGroupMembership> {
    await this.findOne(tenantId, id);
    return this.prisma.smallGroupMembership.update({ where: { id }, data: { isActive: false } });
  }

  private async assertSmallGroupExists(tenantId: string, smallGroupId: string) {
    const smallGroup = await this.prisma.smallGroup.findFirst({ where: { id: smallGroupId, tenantId, deletedAt: null } });
    if (!smallGroup) throw new NotFoundException({ code: 'SMALL_GROUP_NOT_FOUND', message: 'Small group not found.' });
    return smallGroup;
  }

  private async assertMemberExists(tenantId: string, memberId: string): Promise<void> {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId, deletedAt: null } });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
  }

  private async assertNotAlreadyMember(tenantId: string, smallGroupId: string, memberId: string): Promise<void> {
    const existing = await this.prisma.smallGroupMembership.findFirst({ where: { tenantId, smallGroupId, memberId } });
    if (existing) {
      throw new ConflictException({
        code: 'SMALL_GROUP_MEMBERSHIP_ALREADY_EXISTS',
        message: 'This member already has a membership record for this small group.',
      });
    }
  }
}
