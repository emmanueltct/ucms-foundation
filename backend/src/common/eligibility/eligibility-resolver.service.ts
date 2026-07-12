import { Injectable } from '@nestjs/common';
import { Branch, DynamicModuleRecord, ResourceAssignment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

/** Must match `DEPARTMENTS_MODULE_KEY` in `departments.service.ts` — not imported directly to avoid a cross-module coupling for one string constant. */
const DEPARTMENTS_MODULE_KEY = 'departments';

export interface EligibilityScope {
  scopeEntityType: string;
  scopeEntityId: string;
}

/**
 * Resolves "given a user, which resources (forms/reports/dashboards/...)
 * are they currently eligible for" (§13) — a new resolution *direction*
 * over the existing `ResourceAssignment` table (scope → resource), not a
 * new attachment mechanism. Unions every scope a user belongs to: their
 * branch + its ancestors (an assignment made at a parent branch cascades
 * DOWN to descendants — note this is the OPPOSITE roll-up direction from
 * `BranchScopeService`'s descendant-based visibility, easy to mix up),
 * their department + its ancestors, every `LeadershipAppointment` target,
 * their `userCategory`, themselves directly (`'user'` scope — a request can
 * be aimed at one specific staff member), and every Visitor they're the
 * follow-up assignee for (`'visitor'` scope, via `Visitor.assignedToUserId`
 * — a request to collect data about that one visitor). `'member'` requests
 * are deliberately NOT resolved as a per-user scope here: a form attached to
 * a Member falls back to "whoever has branch access to that member," which
 * is a join against the caller's already-resolved branch scopes rather than
 * a direct personal assignment — see `resolveResourcesFor`. Members/Visitors/
 * Guests are still never themselves eligibility *subjects* here — they
 * aren't `User` rows and can't log in to see a "My Forms" list; they are
 * only ever request *targets*, surfaced to the staff responsible for them.
 */
@Injectable()
export class EligibilityResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadershipScope: LeadershipScopeService,
  ) {}

  async resolveScopesFor(tenantId: string, userId: string): Promise<EligibilityScope[]> {
    const scopes: EligibilityScope[] = [];
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { assignedBranchId: true, assignedDepartmentRecordId: true, userCategory: true },
    });
    if (!user) return scopes;

    // Every user is always "scoped to themselves" — lets an admin request a
    // form directly from one specific staff member, reusing the same
    // ResourceAssignment/eligibility mechanism as every other scope kind.
    scopes.push({ scopeEntityType: 'user', scopeEntityId: userId });

    const assignedVisitors = await this.prisma.visitor.findMany({
      where: { tenantId, assignedToUserId: userId, deletedAt: null },
      select: { id: true },
    });
    for (const v of assignedVisitors) scopes.push({ scopeEntityType: 'visitor', scopeEntityId: v.id });

    if (user.assignedBranchId) {
      scopes.push({ scopeEntityType: 'branch', scopeEntityId: user.assignedBranchId });
      const ancestors = await this.branchAncestors(tenantId, user.assignedBranchId);
      for (const a of ancestors) scopes.push({ scopeEntityType: 'branch', scopeEntityId: a.id });
    }

    if (user.assignedDepartmentRecordId) {
      scopes.push({ scopeEntityType: 'dynamic_module_record', scopeEntityId: user.assignedDepartmentRecordId });
      const departmentsModuleId = await this.departmentsModuleDefinitionId(tenantId);
      if (departmentsModuleId) {
        const ancestors = await this.dynamicModuleRecordAncestors(tenantId, departmentsModuleId, user.assignedDepartmentRecordId);
        for (const a of ancestors) scopes.push({ scopeEntityType: 'dynamic_module_record', scopeEntityId: a.id });
      }
    }

    const appointments = await this.leadershipScope.resolveAppointmentsFor(tenantId, userId);
    for (const appointment of appointments) {
      scopes.push({ scopeEntityType: appointment.targetEntityType, scopeEntityId: appointment.targetEntityId });
    }

    if (user.userCategory) {
      const configItem = await this.prisma.configItem.findUnique({
        where: { tenantId_namespace_key: { tenantId, namespace: 'user_category', key: user.userCategory } },
      });
      if (configItem) scopes.push({ scopeEntityType: 'user_category', scopeEntityId: configItem.id });
    }

    return scopes;
  }

  /**
   * Every resource of `resourceType` assigned to any scope this user belongs
   * to, deduplicated. Queries `ResourceAssignment` directly via Prisma
   * rather than through `ResourceAssignmentsService` — that service's own
   * module needs to depend on this one (§14's notify-on-assign fan-out, see
   * `ResourceAssignmentsService.create`), so going through it here would be
   * a circular module dependency for what's a single, thin `findMany` anyway.
   */
  async resolveResourcesFor(tenantId: string, userId: string, resourceType: string): Promise<ResourceAssignment[]> {
    const scopes = await this.resolveScopesFor(tenantId, userId);
    const seen = new Set<string>();
    const results: ResourceAssignment[] = [];

    for (const scope of scopes) {
      const assignments = await this.prisma.resourceAssignment.findMany({
        where: { tenantId, scopeEntityType: scope.scopeEntityType, scopeEntityId: scope.scopeEntityId, resourceType },
      });
      for (const assignment of assignments) {
        if (!seen.has(assignment.id)) {
          seen.add(assignment.id);
          results.push(assignment);
        }
      }
    }

    // "Attached to a Member" requests don't fall to one direct assignee —
    // they fall back to whoever has branch access to that member, so this
    // can't be expressed as a plain scope the caller "belongs to" the way
    // every other scope kind above is. Join instead: every member-scoped
    // assignment of this resourceType, kept only if the member's branch is
    // one the caller is already scoped to.
    const branchIds = scopes.filter((s) => s.scopeEntityType === 'branch').map((s) => s.scopeEntityId);
    if (branchIds.length > 0) {
      const memberAssignments = await this.prisma.resourceAssignment.findMany({
        where: { tenantId, scopeEntityType: 'member', resourceType },
      });
      if (memberAssignments.length > 0) {
        const memberIds = memberAssignments.map((a) => a.scopeEntityId);
        const membersInScope = await this.prisma.member.findMany({
          where: { id: { in: memberIds }, tenantId, branchId: { in: branchIds } },
          select: { id: true },
        });
        const memberIdsInScope = new Set(membersInScope.map((m) => m.id));
        for (const assignment of memberAssignments) {
          if (memberIdsInScope.has(assignment.scopeEntityId) && !seen.has(assignment.id)) {
            seen.add(assignment.id);
            results.push(assignment);
          }
        }
      }
    }

    return results;
  }

  /**
   * The reverse direction of `resolveScopesFor` — given a scope (e.g. a
   * branch a form was just assigned to), which users currently belong to
   * it. Used to fan out "a form was assigned to you" notifications (§14) at
   * `ResourceAssignmentsService.create` time. Mirrors each branch of
   * `resolveScopesFor` in reverse: branch/department roll-ups walk
   * DESCENDANTS (the opposite direction of the forward resolver, which
   * walks ancestors) so a form assigned at a parent still reaches every
   * user nested underneath it; leadership appointments and user-category
   * are direct lookups either way.
   */
  async resolveUsersEligibleForScope(tenantId: string, scopeEntityType: string, scopeEntityId: string): Promise<string[]> {
    const userIds = new Set<string>();

    if (scopeEntityType === 'user') {
      userIds.add(scopeEntityId);
    } else if (scopeEntityType === 'visitor') {
      const visitor = await this.prisma.visitor.findFirst({ where: { id: scopeEntityId, tenantId }, select: { assignedToUserId: true } });
      if (visitor?.assignedToUserId) userIds.add(visitor.assignedToUserId);
    } else if (scopeEntityType === 'member') {
      const member = await this.prisma.member.findFirst({ where: { id: scopeEntityId, tenantId }, select: { branchId: true } });
      if (member) {
        const descendants = await this.branchDescendants(tenantId, member.branchId);
        const branchIds = [member.branchId, ...descendants.map((d) => d.id)];
        const users = await this.prisma.user.findMany({ where: { tenantId, assignedBranchId: { in: branchIds } }, select: { id: true } });
        users.forEach((u) => userIds.add(u.id));
      }
    } else if (scopeEntityType === 'branch') {
      const descendants = await this.branchDescendants(tenantId, scopeEntityId);
      const branchIds = [scopeEntityId, ...descendants.map((d) => d.id)];
      const users = await this.prisma.user.findMany({ where: { tenantId, assignedBranchId: { in: branchIds } }, select: { id: true } });
      users.forEach((u) => userIds.add(u.id));
    } else if (scopeEntityType === 'dynamic_module_record') {
      const record = await this.prisma.dynamicModuleRecord.findFirst({ where: { id: scopeEntityId, tenantId }, select: { moduleDefinitionId: true } });
      if (record) {
        const descendants = await this.dynamicModuleRecordDescendants(tenantId, record.moduleDefinitionId, scopeEntityId);
        const recordIds = [scopeEntityId, ...descendants.map((d) => d.id)];
        const users = await this.prisma.user.findMany({ where: { tenantId, assignedDepartmentRecordId: { in: recordIds } }, select: { id: true } });
        users.forEach((u) => userIds.add(u.id));
      }
    } else if (scopeEntityType === 'user_category') {
      const configItem = await this.prisma.configItem.findFirst({ where: { id: scopeEntityId, tenantId } });
      if (configItem) {
        const users = await this.prisma.user.findMany({ where: { tenantId, userCategory: configItem.key }, select: { id: true } });
        users.forEach((u) => userIds.add(u.id));
      }
    }

    const appointments = await this.prisma.leadershipAppointment.findMany({
      where: { tenantId, targetEntityType: scopeEntityType, targetEntityId: scopeEntityId },
      select: { userId: true },
    });
    appointments.forEach((a) => userIds.add(a.userId));

    return Array.from(userIds);
  }

  /**
   * Mirrors `BranchesService.findAncestors` exactly — duplicated (rather
   * than injecting `BranchesService`) because `BranchesModule` needs to
   * depend on this module too (§14's notify-on-assign fan-out, via
   * `FormAssignmentNotifier`), and this module already can't depend on
   * `ResourceAssignmentsModule` for the same reason — a third mutual
   * dependency on `BranchesModule` would recreate the exact cycle that fix
   * was for. This tree-walk is small and self-contained enough that
   * duplicating it here is cheaper than restructuring three modules further.
   */
  private async branchAncestors(tenantId: string, branchId: string): Promise<Branch[]> {
    const ancestors: Branch[] = [];
    const visited = new Set<string>([branchId]);
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
    let currentParentId = branch?.parentBranchId ?? null;

    while (currentParentId) {
      if (visited.has(currentParentId)) break;
      visited.add(currentParentId);
      const parent = await this.prisma.branch.findFirst({ where: { id: currentParentId, tenantId, deletedAt: null } });
      if (!parent) break;
      ancestors.push(parent);
      currentParentId = parent.parentBranchId;
    }
    return ancestors;
  }

  /** Mirrors `BranchesService.findDescendants` exactly — see `branchAncestors`'s comment for why this is duplicated rather than injected. */
  private async branchDescendants(tenantId: string, branchId: string): Promise<Branch[]> {
    const all = await this.prisma.branch.findMany({ where: { tenantId, deletedAt: null } });
    const childrenByParent = new Map<string, Branch[]>();
    for (const branch of all) {
      if (!branch.parentBranchId) continue;
      const siblings = childrenByParent.get(branch.parentBranchId) ?? [];
      siblings.push(branch);
      childrenByParent.set(branch.parentBranchId, siblings);
    }

    const descendants: Branch[] = [];
    const queue = [...(childrenByParent.get(branchId) ?? [])];
    while (queue.length) {
      const next = queue.shift()!;
      descendants.push(next);
      queue.push(...(childrenByParent.get(next.id) ?? []));
    }
    return descendants;
  }

  private async departmentsModuleDefinitionId(tenantId: string): Promise<string | null> {
    const definition = await this.prisma.dynamicModuleDefinition.findFirst({ where: { tenantId, key: DEPARTMENTS_MODULE_KEY } });
    return definition?.id ?? null;
  }

  /**
   * Mirrors `DynamicModuleRecordsService.ancestors` exactly — duplicated
   * (rather than injecting `DynamicModuleRecordsService`) because
   * `DynamicModulesModule` needs to depend on this module too (row-level
   * record visibility scoping, so a caller without the module-wide
   * permission still sees only records within their own resolved scope),
   * and this service already can't depend on `ResourceAssignmentsModule`/
   * `BranchesModule` for the same reason — see `branchAncestors`'s comment.
   */
  private async dynamicModuleRecordAncestors(tenantId: string, moduleDefinitionId: string, id: string): Promise<DynamicModuleRecord[]> {
    const ancestors: DynamicModuleRecord[] = [];
    const visited = new Set<string>([id]);
    const record = await this.prisma.dynamicModuleRecord.findFirst({ where: { id, tenantId, moduleDefinitionId, deletedAt: null } });
    let currentParentId = record?.parentRecordId ?? null;

    while (currentParentId) {
      if (visited.has(currentParentId)) break;
      visited.add(currentParentId);
      const parent = await this.prisma.dynamicModuleRecord.findFirst({
        where: { id: currentParentId, tenantId, moduleDefinitionId, deletedAt: null },
      });
      if (!parent) break;
      ancestors.push(parent);
      currentParentId = parent.parentRecordId;
    }
    return ancestors;
  }

  /** Mirrors `DynamicModuleRecordsService.descendants` exactly — see `dynamicModuleRecordAncestors`'s comment for why this is duplicated rather than injected. */
  private async dynamicModuleRecordDescendants(tenantId: string, moduleDefinitionId: string, id: string): Promise<DynamicModuleRecord[]> {
    const all = await this.prisma.dynamicModuleRecord.findMany({ where: { tenantId, moduleDefinitionId, deletedAt: null } });
    const childrenByParent = new Map<string, DynamicModuleRecord[]>();
    for (const record of all) {
      if (!record.parentRecordId) continue;
      const siblings = childrenByParent.get(record.parentRecordId) ?? [];
      siblings.push(record);
      childrenByParent.set(record.parentRecordId, siblings);
    }

    const descendants: DynamicModuleRecord[] = [];
    const queue = [...(childrenByParent.get(id) ?? [])];
    while (queue.length) {
      const next = queue.shift()!;
      descendants.push(next);
      queue.push(...(childrenByParent.get(next.id) ?? []));
    }
    return descendants;
  }
}
