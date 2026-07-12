import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Branch } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { AssignBranchResourceDto } from './dto/assign-branch-resource.dto';
import { HierarchyLevelsService } from '../hierarchy-levels/hierarchy-levels.service';
import { LeadershipScopeService } from '../common/leadership-scope/leadership-scope.service';
import { FormAssignmentNotifier } from '../common/form-assignment-notifier/form-assignment-notifier.service';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

/** `ResourceAssignment.scopeEntityType` used for every branch (mirrors `DEPARTMENTS_MODULE_KEY`'s sibling constant in departments.service.ts). */
const SCOPE_ENTITY_TYPE = 'branch';

export interface BranchTreeNode extends Branch {
  children: BranchTreeNode[];
}

/**
 * Church & Hierarchy Management — the organizational tree every later
 * module (Member Management, Finance, ...) attaches records to. Modeled as
 * a single self-referencing `Branch` tree rather than fixed levels
 * (diocese/parish/etc.) so it fits denominations with very different
 * shapes; see the model comment in schema.prisma.
 */
@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hierarchyLevels: HierarchyLevelsService,
    private readonly leadershipScope: LeadershipScopeService,
    private readonly formAssignmentNotifier: FormAssignmentNotifier,
  ) {}

  /**
   * `callerUserId` is optional and, when omitted, skips the caller-scope
   * check entirely — system-initiated creates (e.g. onboarding's
   * auto-provisioned headquarters branch) aren't acting on behalf of a
   * specific delegated Branch Administrator and should never be scoped.
   */
  async create(tenantId: string, dto: CreateBranchDto, callerUserId?: string): Promise<Branch> {
    if (dto.parentBranchId) {
      const parent = await this.findOne(tenantId, dto.parentBranchId);
      await this.assertHierarchyRules(tenantId, dto.branchType, parent.branchType);
    }

    if (callerUserId) {
      await this.assertCallerScope(tenantId, callerUserId, dto.parentBranchId ?? null);
    }

    if (dto.isHeadquarters) {
      await this.clearExistingHeadquarters(tenantId);
    }

    return this.prisma.branch.create({
      data: {
        tenantId,
        name: dto.name,
        parentBranchId: dto.parentBranchId ?? null,
        branchType: dto.branchType,
        code: dto.code,
        address: dto.address,
        isHeadquarters: dto.isHeadquarters ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /** Flat list, ordered for display — callers that need the tree should use `findTree`. */
  async findAll(tenantId: string, includeInactive = false): Promise<Branch[]> {
    return this.prisma.branch.findMany({
      where: { tenantId, deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string): Promise<Branch> {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
    return branch;
  }

  /** Assembles the flat list into a nested tree in memory — fine at church-hierarchy scale (tens/hundreds of branches). */
  async findTree(tenantId: string, includeInactive = false): Promise<BranchTreeNode[]> {
    const branches = await this.findAll(tenantId, includeInactive);
    const byId = new Map<string, BranchTreeNode>(branches.map((b) => [b.id, { ...b, children: [] }]));
    const roots: BranchTreeNode[] = [];

    for (const branch of byId.values()) {
      if (branch.parentBranchId && byId.has(branch.parentBranchId)) {
        byId.get(branch.parentBranchId)!.children.push(branch);
      } else {
        roots.push(branch);
      }
    }
    return roots;
  }

  /** Ancestor chain from immediate parent up to the root. */
  async findAncestors(tenantId: string, id: string): Promise<Branch[]> {
    const branch = await this.findOne(tenantId, id);
    const ancestors: Branch[] = [];
    let currentParentId = branch.parentBranchId;
    const visited = new Set<string>([id]);

    while (currentParentId) {
      if (visited.has(currentParentId)) break; // defensive: never trust data blindly, even though `move` prevents cycles
      visited.add(currentParentId);
      const parent = await this.prisma.branch.findFirst({ where: { id: currentParentId, tenantId, deletedAt: null } });
      if (!parent) break;
      ancestors.push(parent);
      currentParentId = parent.parentBranchId;
    }
    return ancestors;
  }

  /** All descendants (children, grandchildren, ...) of a branch, flattened. */
  async findDescendants(tenantId: string, id: string): Promise<Branch[]> {
    await this.findOne(tenantId, id);
    const all = await this.prisma.branch.findMany({ where: { tenantId, deletedAt: null } });
    const childrenByParent = new Map<string, Branch[]>();
    for (const branch of all) {
      if (!branch.parentBranchId) continue;
      const siblings = childrenByParent.get(branch.parentBranchId) ?? [];
      siblings.push(branch);
      childrenByParent.set(branch.parentBranchId, siblings);
    }

    const descendants: Branch[] = [];
    const queue = [...(childrenByParent.get(id) ?? [])];
    while (queue.length) {
      const next = queue.shift()!;
      descendants.push(next);
      queue.push(...(childrenByParent.get(next.id) ?? []));
    }
    return descendants;
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto): Promise<Branch> {
    await this.findOne(tenantId, id);

    if (dto.isHeadquarters) {
      await this.clearExistingHeadquarters(tenantId, id);
    }

    return this.prisma.branch.update({
      where: { id },
      data: {
        name: dto.name,
        branchType: dto.branchType,
        code: dto.code,
        address: dto.address,
        isHeadquarters: dto.isHeadquarters,
        sortOrder: dto.sortOrder,
      },
    });
  }

  /** Re-parents a branch, rejecting moves that would create a cycle (a branch becoming its own descendant's child). */
  async move(tenantId: string, id: string, newParentBranchId: string | null | undefined): Promise<Branch> {
    const branch = await this.findOne(tenantId, id);

    if (newParentBranchId) {
      if (newParentBranchId === id) {
        throw new BadRequestException({ code: 'BRANCH_CIRCULAR_REFERENCE', message: 'A branch cannot be its own parent.' });
      }
      const newParent = await this.findOne(tenantId, newParentBranchId);

      const targetAncestors = await this.findAncestors(tenantId, newParentBranchId);
      if (targetAncestors.some((ancestor) => ancestor.id === id)) {
        throw new BadRequestException({
          code: 'BRANCH_CIRCULAR_REFERENCE',
          message: 'Cannot move a branch under one of its own descendants.',
        });
      }

      await this.assertHierarchyRules(tenantId, branch.branchType, newParent.branchType);
    }

    return this.prisma.branch.update({ where: { id }, data: { parentBranchId: newParentBranchId ?? null } });
  }

  /** Soft-deactivates this branch and every descendant, so historical records (members, contributions) keep a valid reference. */
  async deactivate(tenantId: string, id: string): Promise<Branch> {
    const branch = await this.findOne(tenantId, id);
    const descendants = await this.findDescendants(tenantId, id);
    const idsToDeactivate = [id, ...descendants.map((d) => d.id)];

    await this.prisma.branch.updateMany({ where: { id: { in: idsToDeactivate }, tenantId }, data: { isActive: false } });
    return { ...branch, isActive: false };
  }

  /** Reactivates only this branch — descendants that were independently deactivated stay as they were. */
  async reactivate(tenantId: string, id: string): Promise<Branch> {
    await this.findOne(tenantId, id);
    return this.prisma.branch.update({ where: { id }, data: { isActive: true } });
  }

  /**
   * Soft-deletes this branch and every descendant (distinct from `deactivate`
   * — a deleted branch is meant to disappear from the org chart entirely,
   * not just go temporarily inactive). Historical records (members,
   * contributions) keep a valid FK reference since the row is never
   * hard-deleted. Restore (see TrashService) only ever un-deletes the single
   * branch, mirroring `reactivate`'s narrower-than-`deactivate` asymmetry.
   */
  async softDelete(tenantId: string, id: string): Promise<Branch> {
    const branch = await this.findOne(tenantId, id);
    const descendants = await this.findDescendants(tenantId, id);
    const idsToDelete = [id, ...descendants.map((d) => d.id)];
    const now = new Date();
    await this.prisma.branch.updateMany({ where: { id: { in: idsToDelete }, tenantId }, data: { deletedAt: now, isActive: false } });
    return { ...branch, deletedAt: now, isActive: false };
  }

  async listResources(tenantId: string, id: string) {
    await this.findOne(tenantId, id); // 404s via the same path as any other read
    return this.prisma.resourceAssignment.findMany({
      where: { tenantId, scopeEntityType: SCOPE_ENTITY_TYPE, scopeEntityId: id },
      orderBy: [{ resourceType: 'asc' }, { resourceKey: 'asc' }],
    });
  }

  /**
   * No static `@Permissions()` on the controller route for this and
   * `removeResource` — mirrors `DepartmentsService.assignResource` exactly.
   * `assertResourceManageable` also accepts a caller who holds a Phase 14
   * `LeadershipAppointment` over this specific branch (its "Assigned
   * Administrator"), turning the tenant-wide `branch.update` grant into a
   * per-branch scope the same way `DepartmentScopeService.isLeaderOf` does
   * for departments. Queries `ResourceAssignment` directly via Prisma
   * rather than through `ResourceAssignmentsService` — that service's own
   * module needs to depend on this one (§14's notify-on-assign fan-out
   * resolves eligible users via `BranchesService.findDescendants`), so
   * going through it here would be a circular module dependency.
   */
  async assignResource(tenantId: string, id: string, dto: AssignBranchResourceDto, user: AuthenticatedUser) {
    await this.findOne(tenantId, id);
    await this.assertResourceManageable(tenantId, id, user);

    const existing = await this.prisma.resourceAssignment.findUnique({
      where: {
        tenantId_scopeEntityType_scopeEntityId_resourceType_resourceKey: {
          tenantId,
          scopeEntityType: SCOPE_ENTITY_TYPE,
          scopeEntityId: id,
          resourceType: dto.resourceType,
          resourceKey: dto.resourceKey,
        },
      },
    });
    if (existing) {
      throw new BadRequestException({ code: 'RESOURCE_ASSIGNMENT_ALREADY_EXISTS', message: 'This resource is already assigned to this branch.' });
    }

    const assignment = await this.prisma.resourceAssignment.create({
      data: {
        tenantId,
        scopeEntityType: SCOPE_ENTITY_TYPE,
        scopeEntityId: id,
        resourceType: dto.resourceType,
        resourceKey: dto.resourceKey,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
    });

    await this.formAssignmentNotifier.notifyIfForm(tenantId, assignment);

    return assignment;
  }

  async removeResource(tenantId: string, id: string, assignmentId: string, user: AuthenticatedUser) {
    await this.findOne(tenantId, id);
    await this.assertResourceManageable(tenantId, id, user);

    const existing = await this.prisma.resourceAssignment.findFirst({ where: { id: assignmentId, tenantId } });
    if (!existing) throw new NotFoundException({ code: 'RESOURCE_ASSIGNMENT_NOT_FOUND', message: 'Resource assignment not found.' });
    await this.prisma.resourceAssignment.delete({ where: { id: assignmentId } });
    return { id: assignmentId };
  }

  private async assertResourceManageable(tenantId: string, branchId: string, user: AuthenticatedUser): Promise<void> {
    if (user.isPlatformAdmin || user.permissions.includes('branch.update')) return;
    if (await this.leadershipScope.isLeaderOf(tenantId, user.userId, SCOPE_ENTITY_TYPE, branchId)) return;
    throw new ForbiddenException({
      code: 'BRANCH_RESOURCE_FORBIDDEN',
      message: 'You do not have permission to manage this branch\'s assigned resources.',
    });
  }

  /**
   * Branch-scoped delegation guard — a "Branch Administrator"/"Branch
   * Leader" is just a `User` with `assignedBranchId` set plus an
   * appropriately-permissioned Role (no new model). Such a caller may only
   * create sub-branches under their own visible scope (their branch or one
   * of its descendants — the same roll-up `BranchScopeService` computes,
   * inlined here rather than injected to avoid a circular dependency, since
   * `BranchScopeService` itself depends on `BranchesService`). A caller with
   * no `assignedBranchId` (the default — church-wide staff/admin) is
   * unrestricted, exactly matching `BranchScopeService`'s own convention.
   */
  private async assertCallerScope(tenantId: string, callerUserId: string, parentBranchId: string | null): Promise<void> {
    const caller = await this.prisma.user.findFirst({ where: { id: callerUserId, tenantId }, select: { assignedBranchId: true } });
    if (!caller?.assignedBranchId) return;

    if (!parentBranchId) {
      throw new ForbiddenException({
        code: 'BRANCH_SCOPE_FORBIDDEN',
        message: 'You can only create branches within your own assigned branch.',
      });
    }

    const descendants = await this.findDescendants(tenantId, caller.assignedBranchId);
    const visibleIds = new Set([caller.assignedBranchId, ...descendants.map((d) => d.id)]);
    if (!visibleIds.has(parentBranchId)) {
      throw new ForbiddenException({
        code: 'BRANCH_SCOPE_FORBIDDEN',
        message: 'You can only create sub-branches under your own assigned branch.',
      });
    }
  }

  /**
   * Additive rules check — only applies when both sides have a branchType
   * AND at least one of them has a `HierarchyLevelDefinition` row with
   * non-empty allow-lists. Every existing tenant has zero rows, so this is
   * fully inert (matches pre-Phase-3 behavior exactly) until a tenant opts
   * in by defining rules. See `HierarchyLevelsService`.
   */
  private async assertHierarchyRules(
    tenantId: string,
    childBranchType: string | null | undefined,
    parentBranchType: string | null | undefined,
  ): Promise<void> {
    if (!childBranchType || !parentBranchType) return;

    const [childLevel, parentLevel] = await Promise.all([
      this.hierarchyLevels.findForType(tenantId, childBranchType),
      this.hierarchyLevels.findForType(tenantId, parentBranchType),
    ]);

    if (childLevel && childLevel.allowedParentTypeKeys.length > 0 && !childLevel.allowedParentTypeKeys.includes(parentBranchType)) {
      throw new BadRequestException({
        code: 'HIERARCHY_LEVEL_INVALID_PARENT',
        message: `"${childLevel.label}" cannot be nested under a branch of type "${parentBranchType}".`,
      });
    }
    if (parentLevel && parentLevel.allowedChildTypeKeys.length > 0 && !parentLevel.allowedChildTypeKeys.includes(childBranchType)) {
      throw new BadRequestException({
        code: 'HIERARCHY_LEVEL_INVALID_CHILD',
        message: `A branch of type "${parentLevel.label}" cannot have a child of type "${childBranchType}".`,
      });
    }
  }

  private async clearExistingHeadquarters(tenantId: string, exceptId?: string): Promise<void> {
    await this.prisma.branch.updateMany({
      where: { tenantId, isHeadquarters: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isHeadquarters: false },
    });
  }
}
