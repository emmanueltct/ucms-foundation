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
  myRecords: Array<{ id: string; status: string; createdAt: Date; updatedAt: Date }>;
}

/**
 * The dashboard-facing consumer of §13's eligibility resolver — "every form
 * currently assigned to me, with my own submission(s) against each, if any"
 * (§14). Deliberately its own small module rather than folded into
 * `DynamicModuleRecordsController` (which is scoped to one
 * `:moduleDefinitionId` at a time via its route) — this is a cross-module
 * listing, the exact shape a per-module-scoped controller can't express.
 */
@Injectable()
export class MyFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibilityResolver: EligibilityResolverService,
  ) {}

  async list(tenantId: string, userId: string): Promise<MyFormAssignment[]> {
    const assignments = await this.eligibilityResolver.resolveResourcesFor(tenantId, userId, FORM_RESOURCE_TYPE);
    const earliestDueByDefinitionId = this.earliestDueByDefinitionId(assignments);

    const results: MyFormAssignment[] = [];
    for (const [definitionId, dueAt] of earliestDueByDefinitionId) {
      const definition = await this.prisma.dynamicModuleDefinition.findFirst({ where: { id: definitionId, tenantId, deletedAt: null } });
      if (!definition) continue;

      const myRecords = await this.prisma.dynamicModuleRecord.findMany({
        where: { tenantId, moduleDefinitionId: definitionId, createdByUserId: userId, deletedAt: null },
        select: { id: true, status: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'desc' },
      });

      results.push({
        definitionId: definition.id,
        key: definition.key,
        label: definition.label,
        description: definition.description,
        statuses: definition.statuses,
        dueAt,
        myRecords,
      });
    }
    return results;
  }

  /** One row per unique form, keeping whichever assigned deadline is soonest when the same form reaches this user through more than one scope. */
  private earliestDueByDefinitionId(assignments: ResourceAssignment[]): Map<string, Date | null> {
    const map = new Map<string, Date | null>();
    for (const assignment of assignments) {
      const definitionId = assignment.resourceKey;
      const current = map.get(definitionId);
      if (!map.has(definitionId)) {
        map.set(definitionId, assignment.dueAt);
      } else if (assignment.dueAt && (!current || assignment.dueAt < current)) {
        map.set(definitionId, assignment.dueAt);
      }
    }
    return map;
  }
}
