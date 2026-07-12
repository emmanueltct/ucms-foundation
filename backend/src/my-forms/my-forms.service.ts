import { Injectable } from '@nestjs/common';
import { ResourceAssignment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EligibilityResolverService } from '../common/eligibility/eligibility-resolver.service';
import { FORM_RESOURCE_TYPE } from '../resource-assignments/resource-assignments.service';

export interface MyFormAssignment {
  definitionId: string;
  key: string;
  label: string;
  description: string | null;
  statuses: string[];
  dueAt: Date | null;
  /** Set only when this request was attached directly to one Visitor/Member — null for a generic (branch/ministry/small_group/user_category/user) assignment. */
  attachedToEntityType: string | null;
  attachedToEntityId: string | null;
  attachedToEntityLabel: string | null;
  myRecords: Array<{ id: string; status: string; createdAt: Date; updatedAt: Date }>;
}

const ENTITY_SCOPE_TYPES = new Set(['visitor', 'member']);

/**
 * The dashboard-facing consumer of §13's eligibility resolver — "every form
 * currently assigned to me, with my own submission(s) against each, if any"
 * (§14). Deliberately its own small module rather than folded into
 * `DynamicModuleRecordsController` (which is scoped to one
 * `:moduleDefinitionId` at a time via its route) — this is a cross-module
 * listing, the exact shape a per-module-scoped controller can't express.
 *
 * A request attached directly to a Visitor/Member (see `EligibilityResolverService`)
 * is never collapsed with a generic assignment of the same form, or with
 * another visitor/member's request for that same form — each is kept as its
 * own row (Design Decision: one visitor's "please collect this" is a
 * distinct task from another's, even for the identical form), and its
 * completion is judged by whether a record is already attached to that
 * specific entity — not by who created it, since the point is the entity's
 * data, not the filler's own submission history.
 */
@Injectable()
export class MyFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibilityResolver: EligibilityResolverService,
  ) {}

  async list(tenantId: string, userId: string): Promise<MyFormAssignment[]> {
    const assignments = await this.eligibilityResolver.resolveResourcesFor(tenantId, userId, FORM_RESOURCE_TYPE);
    const groups = this.groupAssignments(assignments);

    const visitorIds = groups.filter((g) => g.attachedToEntityType === 'visitor').map((g) => g.attachedToEntityId!);
    const memberIds = groups.filter((g) => g.attachedToEntityType === 'member').map((g) => g.attachedToEntityId!);
    const [visitors, members] = await Promise.all([
      visitorIds.length > 0
        ? this.prisma.visitor.findMany({ where: { id: { in: visitorIds }, tenantId }, select: { id: true, firstName: true, lastName: true } })
        : Promise.resolve([]),
      memberIds.length > 0
        ? this.prisma.member.findMany({ where: { id: { in: memberIds }, tenantId }, select: { id: true, firstName: true, lastName: true } })
        : Promise.resolve([]),
    ]);
    const visitorNameById = new Map(visitors.map((v) => [v.id, `${v.firstName} ${v.lastName}`]));
    const memberNameById = new Map(members.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));

    const results: MyFormAssignment[] = [];
    for (const group of groups) {
      const definition = await this.prisma.dynamicModuleDefinition.findFirst({ where: { id: group.definitionId, tenantId, deletedAt: null } });
      if (!definition) continue;

      const myRecords = group.attachedToEntityType
        ? await this.prisma.dynamicModuleRecord.findMany({
            where: {
              tenantId,
              moduleDefinitionId: group.definitionId,
              attachedToEntityType: group.attachedToEntityType,
              attachedToEntityId: group.attachedToEntityId,
              deletedAt: null,
            },
            select: { id: true, status: true, createdAt: true, updatedAt: true },
            orderBy: { createdAt: 'desc' },
          })
        : await this.prisma.dynamicModuleRecord.findMany({
            where: { tenantId, moduleDefinitionId: group.definitionId, createdByUserId: userId, deletedAt: null },
            select: { id: true, status: true, createdAt: true, updatedAt: true },
            orderBy: { createdAt: 'desc' },
          });

      const attachedToEntityLabel =
        group.attachedToEntityType === 'visitor'
          ? visitorNameById.get(group.attachedToEntityId!) ?? null
          : group.attachedToEntityType === 'member'
            ? memberNameById.get(group.attachedToEntityId!) ?? null
            : null;

      results.push({
        definitionId: definition.id,
        key: definition.key,
        label: definition.label,
        description: definition.description,
        statuses: definition.statuses,
        dueAt: group.dueAt,
        attachedToEntityType: group.attachedToEntityType,
        attachedToEntityId: group.attachedToEntityId,
        attachedToEntityLabel,
        myRecords,
      });
    }
    return results;
  }

  /**
   * One row per unique form, keeping whichever assigned deadline is soonest
   * when the same form reaches this user through more than one non-entity
   * scope (branch/ministry/small_group/user_category/user) — unchanged from
   * before. A `visitor`/`member`-scoped assignment is never merged into that
   * row, or with another entity's assignment of the same form — each gets
   * its own group, keyed by (resourceKey, scopeEntityType, scopeEntityId).
   */
  private groupAssignments(
    assignments: ResourceAssignment[],
  ): Array<{ definitionId: string; dueAt: Date | null; attachedToEntityType: string | null; attachedToEntityId: string | null }> {
    const generic = new Map<string, Date | null>();
    const entityScoped: Array<{ definitionId: string; dueAt: Date | null; attachedToEntityType: string; attachedToEntityId: string }> = [];

    for (const assignment of assignments) {
      const definitionId = assignment.resourceKey;
      if (ENTITY_SCOPE_TYPES.has(assignment.scopeEntityType)) {
        entityScoped.push({
          definitionId,
          dueAt: assignment.dueAt,
          attachedToEntityType: assignment.scopeEntityType,
          attachedToEntityId: assignment.scopeEntityId,
        });
        continue;
      }
      const current = generic.get(definitionId);
      if (!generic.has(definitionId)) {
        generic.set(definitionId, assignment.dueAt);
      } else if (assignment.dueAt && (!current || assignment.dueAt < current)) {
        generic.set(definitionId, assignment.dueAt);
      }
    }

    const genericGroups = Array.from(generic.entries()).map(([definitionId, dueAt]) => ({
      definitionId,
      dueAt,
      attachedToEntityType: null,
      attachedToEntityId: null,
    }));
    return [...genericGroups, ...entityScoped];
  }
}
