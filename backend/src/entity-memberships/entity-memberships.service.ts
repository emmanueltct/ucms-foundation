import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityMembership } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEntityMembershipDto } from './dto/create-entity-membership.dto';
import { UpdateEntityMembershipDto } from './dto/update-entity-membership.dto';
import { EntityMembershipQueryDto } from './dto/entity-membership-query.dto';

const DYNAMIC_MODULE_ENTITY_PREFIX = 'dynamicmodule:';

/**
 * Generalizes `MinistryMembership`/`SmallGroupMembership`'s shape — a
 * `Member` attaches to an entity with a role, never duplicated as a new
 * `Member` row — for Dynamic Module entities specifically. See
 * docs/dynamic-modules/business-analysis.md. The two existing hand-rolled
 * membership tables are untouched; this only covers entities with no
 * dedicated membership table of their own.
 */
@Injectable()
export class EntityMembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateEntityMembershipDto): Promise<EntityMembership> {
    await this.assertMemberExists(tenantId, dto.memberId);
    await this.assertEntityExists(tenantId, dto.attachedToEntityType, dto.attachedToEntityId);
    await this.assertNotAlreadyMember(tenantId, dto.attachedToEntityType, dto.attachedToEntityId, dto.memberId);

    return this.prisma.entityMembership.create({
      data: {
        tenantId,
        attachedToEntityType: dto.attachedToEntityType,
        attachedToEntityId: dto.attachedToEntityId,
        memberId: dto.memberId,
        role: dto.role ?? 'member',
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : new Date(),
      },
    });
  }

  async findAll(tenantId: string, query: EntityMembershipQueryDto) {
    const where = {
      tenantId,
      ...(query.attachedToEntityType ? { attachedToEntityType: query.attachedToEntityType } : {}),
      ...(query.attachedToEntityId ? { attachedToEntityId: query.attachedToEntityId } : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.role ? { role: query.role } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.entityMembership.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { createdAt: 'desc' },
      }),
      this.prisma.entityMembership.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<EntityMembership> {
    const membership = await this.prisma.entityMembership.findFirst({ where: { id, tenantId } });
    if (!membership) {
      throw new NotFoundException({ code: 'ENTITY_MEMBERSHIP_NOT_FOUND', message: 'Entity membership not found.' });
    }
    return membership;
  }

  async update(tenantId: string, id: string, dto: UpdateEntityMembershipDto): Promise<EntityMembership> {
    await this.findOne(tenantId, id);
    return this.prisma.entityMembership.update({ where: { id }, data: { role: dto.role, isActive: dto.isActive } });
  }

  /** Deactivates the membership — the row stays for history, mirroring MinistryMembership's own non-cascading-delete philosophy. */
  async remove(tenantId: string, id: string): Promise<EntityMembership> {
    await this.findOne(tenantId, id);
    return this.prisma.entityMembership.update({ where: { id }, data: { isActive: false } });
  }

  private async assertMemberExists(tenantId: string, memberId: string): Promise<void> {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId, deletedAt: null } });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
  }

  /**
   * Only the Dynamic Module case can be validated structurally — there is no
   * universal entity registry to check other entityType strings against.
   * Other entity types are trusted as given, the same way `attachedToEntityType`/
   * `attachedToEntityId` on a `DynamicModuleRecord` itself are never validated
   * against a lookup table either.
   */
  private async assertEntityExists(tenantId: string, entityType: string, entityId: string): Promise<void> {
    if (!entityType.startsWith(DYNAMIC_MODULE_ENTITY_PREFIX)) return;
    const moduleDefinitionId = entityType.slice(DYNAMIC_MODULE_ENTITY_PREFIX.length);
    const record = await this.prisma.dynamicModuleRecord.findFirst({
      where: { id: entityId, tenantId, moduleDefinitionId, deletedAt: null },
    });
    if (!record) throw new NotFoundException({ code: 'ENTITY_MEMBERSHIP_TARGET_NOT_FOUND', message: 'The entity being joined was not found.' });
  }

  private async assertNotAlreadyMember(tenantId: string, entityType: string, entityId: string, memberId: string): Promise<void> {
    const existing = await this.prisma.entityMembership.findFirst({
      where: { tenantId, attachedToEntityType: entityType, attachedToEntityId: entityId, memberId },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ENTITY_MEMBERSHIP_ALREADY_EXISTS',
        message: 'This member already has a membership record for this entity.',
      });
    }
  }
}
