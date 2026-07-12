import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DynamicModuleRecord, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalWorkflowsService } from '../approval-workflows/approval-workflows.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { ConfigService } from '../config-engine/config.service';
import { EligibilityResolverService } from '../common/eligibility/eligibility-resolver.service';
import { DynamicModuleDefinitionsService } from './dynamic-module-definitions.service';
import { CreateDynamicModuleRecordDto } from './dto/create-dynamic-module-record.dto';
import { CreateDynamicModuleRecordPublicDto } from './dto/create-dynamic-module-record-public.dto';
import { UpdateDynamicModuleRecordDto } from './dto/update-dynamic-module-record.dto';
import { ChangeDynamicModuleRecordStatusDto } from './dto/change-status.dto';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

/** Tenant-wide kill switch for all guest dynamic-module submissions — a per-module `allowPublicSubmission` flag still gates each module individually. */
export const GUEST_ACCESS_MODULES_FEATURE_KEY = 'guest_access.dynamic_modules';

/** Matches the convention `ResourceAssignmentsService`/`FormAssignmentNotifier` use for "this resource is a form/module." */
const FORM_RESOURCE_TYPE = 'dynamic_module_definition';

/**
 * A caller's read access to one module: unrestricted (holds the static
 * `dynamicmodule.{id}.read` permission, or platform admin — a "superior
 * leader" per §15) or scoped to only the records within their own resolved
 * eligibility scope (their own submissions, plus anything under their own
 * branch/department) — reached the module only because it was assigned to a
 * scope they belong to, not because they administer the whole module.
 */
interface ReadScope {
  restricted: boolean;
  callerId: string;
  branchIds: string[];
  otherScopeIds: string[];
}

/** A record's "level" for display — the branch/department/ministry the creator themselves belongs to, resolved fresh from their current profile rather than snapshotted onto the record. */
export interface CreatorContext {
  branchName: string | null;
  departmentName: string | null;
  ministryName: string | null;
}

export type DynamicModuleRecordWithFields = DynamicModuleRecord & { customFields: Record<string, unknown>; creatorContext: CreatorContext | null };

/**
 * A module's records — permission-checked dynamically against
 * `dynamicmodule.{moduleDefinitionId}.{action}` codes (generated at
 * definition-creation time, see DynamicModuleDefinitionsService), since the
 * static `@Permissions()` decorator can't express a code that depends on a
 * route param. Custom fields reuse CustomFieldsService with
 * `entityType: "dynamicmodule:{moduleDefinitionId}"` — the same composition
 * trick Assets/Visitor Activities/Member Activities already use.
 */
@Injectable()
export class DynamicModuleRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvalWorkflows: ApprovalWorkflowsService,
    private readonly customFields: CustomFieldsService,
    private readonly definitions: DynamicModuleDefinitionsService,
    private readonly config: ConfigService,
    private readonly eligibilityResolver: EligibilityResolverService,
  ) {}

  async create(tenantId: string, moduleDefinitionId: string, dto: CreateDynamicModuleRecordDto, user: AuthenticatedUser): Promise<DynamicModuleRecordWithFields> {
    this.assertPermission(user, moduleDefinitionId, 'create');
    const definition = await this.definitions.findOne(tenantId, moduleDefinitionId);
    const entityType = this.fieldsEntityType(moduleDefinitionId);
    await this.customFields.assertRequiredFieldsProvided(tenantId, entityType, dto.customFields);

    if (dto.parentRecordId) await this.findRecordRaw(tenantId, moduleDefinitionId, dto.parentRecordId);

    const record = await this.prisma.dynamicModuleRecord.create({
      data: {
        tenantId,
        moduleDefinitionId,
        attachedToEntityType: dto.attachedToEntityType,
        attachedToEntityId: dto.attachedToEntityId,
        status: definition.statuses[0] ?? 'open',
        title: dto.title,
        branchId: dto.branchId,
        parentRecordId: dto.parentRecordId,
        createdByUserId: user.userId,
      },
    });

    if (dto.customFields) await this.customFields.setValues(tenantId, entityType, record.id, dto.customFields);
    await this.prisma.dynamicModuleRecordStatusHistory.create({
      data: { tenantId, recordId: record.id, fromStatus: null, toStatus: record.status, changedByUserId: user.userId },
    });

    return this.withCustomFields(tenantId, entityType, record);
  }

  /**
   * The unauthenticated counterpart to `create` — no `AuthenticatedUser`,
   * no `assertPermission` (there is no caller identity to check), resolved
   * by the module's `key` rather than its internal id (a guest form has no
   * reason to know the raw UUID). Gated by two independent switches: the
   * per-module `allowPublicSubmission` flag (an admin decision made once,
   * on the module itself) and the tenant-wide `guest_access.dynamic_modules`
   * `FeatureToggle` (a quick kill switch for ALL guest module submissions
   * at once, without having to un-check every module individually).
   */
  async createPublic(tenantId: string, moduleKey: string, dto: CreateDynamicModuleRecordPublicDto): Promise<DynamicModuleRecordWithFields> {
    const definition = await this.definitions.findByKey(tenantId, moduleKey);
    if (!definition.allowPublicSubmission) {
      throw new ForbiddenException({ code: 'PUBLIC_SUBMISSION_DISABLED', message: 'This form is not currently accepting public submissions.' });
    }
    if (!(await this.config.isFeatureEnabled(tenantId, GUEST_ACCESS_MODULES_FEATURE_KEY))) {
      throw new ForbiddenException({ code: 'PUBLIC_SUBMISSION_DISABLED', message: 'This form is not currently accepting public submissions.' });
    }

    const entityType = this.fieldsEntityType(definition.id);
    await this.customFields.assertRequiredFieldsProvided(tenantId, entityType, dto.customFields);

    const record = await this.prisma.dynamicModuleRecord.create({
      data: {
        tenantId,
        moduleDefinitionId: definition.id,
        status: definition.statuses[0] ?? 'open',
        title: dto.title,
        branchId: dto.branchId,
      },
    });

    if (dto.customFields) await this.customFields.setValues(tenantId, entityType, record.id, dto.customFields);
    await this.prisma.dynamicModuleRecordStatusHistory.create({
      data: { tenantId, recordId: record.id, fromStatus: null, toStatus: record.status },
    });

    return this.withCustomFields(tenantId, entityType, record);
  }

  async findAll(
    tenantId: string,
    moduleDefinitionId: string,
    query: { attachedToEntityType?: string; attachedToEntityId?: string; status?: string; branchId?: string },
    user: AuthenticatedUser,
  ): Promise<DynamicModuleRecordWithFields[]> {
    const readScope = await this.resolveReadScope(tenantId, moduleDefinitionId, user);
    const records = await this.prisma.dynamicModuleRecord.findMany({
      where: {
        tenantId,
        moduleDefinitionId,
        deletedAt: null,
        ...(query.attachedToEntityType ? { attachedToEntityType: query.attachedToEntityType } : {}),
        ...(query.attachedToEntityId ? { attachedToEntityId: query.attachedToEntityId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(readScope.restricted ? { OR: this.readScopeOrConditions(readScope) } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const entityType = this.fieldsEntityType(moduleDefinitionId);
    const creatorIds = records.map((r) => r.createdByUserId).filter((id): id is string => !!id);
    const [valuesByRecord, contextsByUser] = await Promise.all([
      this.customFields.getValuesForMany(tenantId, entityType, records.map((r) => r.id)),
      this.resolveCreatorContextsFor(tenantId, creatorIds),
    ]);
    return records.map((r) => ({
      ...r,
      customFields: valuesByRecord[r.id] ?? {},
      creatorContext: (r.createdByUserId && contextsByUser.get(r.createdByUserId)) || null,
    }));
  }

  async findOne(tenantId: string, moduleDefinitionId: string, id: string, user: AuthenticatedUser): Promise<DynamicModuleRecordWithFields> {
    const readScope = await this.resolveReadScope(tenantId, moduleDefinitionId, user);
    const record = await this.findRecordRaw(tenantId, moduleDefinitionId, id);
    // A record outside the caller's own scope simply doesn't exist to them — a 404, not a
    // distinguishable 403, the same way a missing record already behaves for anyone else.
    if (readScope.restricted && !this.matchesReadScope(record, readScope)) {
      throw new NotFoundException({ code: 'DYNAMIC_MODULE_RECORD_NOT_FOUND', message: 'Record not found.' });
    }
    return this.withCustomFields(tenantId, this.fieldsEntityType(moduleDefinitionId), record);
  }

  async update(tenantId: string, moduleDefinitionId: string, id: string, dto: UpdateDynamicModuleRecordDto, user: AuthenticatedUser): Promise<DynamicModuleRecordWithFields> {
    this.assertPermission(user, moduleDefinitionId, 'update');
    await this.findRecordRaw(tenantId, moduleDefinitionId, id);
    const entityType = this.fieldsEntityType(moduleDefinitionId);

    if (dto.parentRecordId) {
      if (dto.parentRecordId === id) {
        throw new BadRequestException({ code: 'DYNAMIC_MODULE_RECORD_INVALID_PARENT', message: 'A record cannot be its own parent.' });
      }
      await this.findRecordRaw(tenantId, moduleDefinitionId, dto.parentRecordId);
      const descendants = await this.descendants(tenantId, moduleDefinitionId, id, user);
      if (descendants.some((d) => d.id === dto.parentRecordId)) {
        throw new BadRequestException({ code: 'DYNAMIC_MODULE_RECORD_INVALID_PARENT', message: 'Cannot set a descendant as this record\'s parent.' });
      }
    }

    const record = await this.prisma.dynamicModuleRecord.update({
      where: { id },
      data: { title: dto.title, branchId: dto.branchId, parentRecordId: dto.parentRecordId },
    });
    if (dto.customFields) await this.customFields.setValues(tenantId, entityType, id, dto.customFields);

    return this.withCustomFields(tenantId, entityType, record);
  }

  /** Every descendant of a record within the same module — mirrors `BranchesService.findDescendants`, used for cycle prevention and (frontend) tree rendering. */
  async descendants(tenantId: string, moduleDefinitionId: string, id: string, user: AuthenticatedUser): Promise<DynamicModuleRecord[]> {
    this.assertPermission(user, moduleDefinitionId, 'read');
    const all = await this.prisma.dynamicModuleRecord.findMany({ where: { tenantId, moduleDefinitionId, deletedAt: null } });
    const childrenByParent = new Map<string, DynamicModuleRecord[]>();
    for (const record of all) {
      if (!record.parentRecordId) continue;
      const siblings = childrenByParent.get(record.parentRecordId) ?? [];
      siblings.push(record);
      childrenByParent.set(record.parentRecordId, siblings);
    }

    const result: DynamicModuleRecord[] = [];
    const queue = [...(childrenByParent.get(id) ?? [])];
    while (queue.length) {
      const next = queue.shift()!;
      result.push(next);
      queue.push(...(childrenByParent.get(next.id) ?? []));
    }
    return result;
  }

  /** Ancestor chain from immediate parent up to the root — mirrors `BranchesService.findAncestors`, needed so an assignment made at a parent record (e.g. a parent department) rolls down to records nested under it (§13 eligibility resolution). */
  async ancestors(tenantId: string, moduleDefinitionId: string, id: string, user: AuthenticatedUser): Promise<DynamicModuleRecord[]> {
    this.assertPermission(user, moduleDefinitionId, 'read');
    const record = await this.findRecordRaw(tenantId, moduleDefinitionId, id);
    const result: DynamicModuleRecord[] = [];
    const visited = new Set<string>([id]);
    let currentParentId = record.parentRecordId;

    while (currentParentId) {
      if (visited.has(currentParentId)) break; // defensive: never trust data blindly
      visited.add(currentParentId);
      const parent = await this.prisma.dynamicModuleRecord.findFirst({
        where: { id: currentParentId, tenantId, moduleDefinitionId, deletedAt: null },
      });
      if (!parent) break;
      result.push(parent);
      currentParentId = parent.parentRecordId;
    }
    return result;
  }

  async softDelete(tenantId: string, moduleDefinitionId: string, id: string, user: AuthenticatedUser): Promise<DynamicModuleRecord> {
    this.assertPermission(user, moduleDefinitionId, 'delete');
    await this.findRecordRaw(tenantId, moduleDefinitionId, id);
    return this.prisma.dynamicModuleRecord.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** No dedicated 'restore' action in `RECORD_ACTIONS` — gated on 'delete', same as softDelete. */
  async deletedRecords(tenantId: string, moduleDefinitionId: string, user: AuthenticatedUser): Promise<DynamicModuleRecord[]> {
    this.assertPermission(user, moduleDefinitionId, 'delete');
    return this.prisma.dynamicModuleRecord.findMany({
      where: { tenantId, moduleDefinitionId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: 200,
    });
  }

  async restore(tenantId: string, moduleDefinitionId: string, id: string, user: AuthenticatedUser): Promise<DynamicModuleRecord> {
    this.assertPermission(user, moduleDefinitionId, 'delete');
    const record = await this.prisma.dynamicModuleRecord.findFirst({
      where: { id, tenantId, moduleDefinitionId, deletedAt: { not: null } },
    });
    if (!record) throw new NotFoundException({ code: 'DYNAMIC_MODULE_RECORD_NOT_FOUND', message: 'Deleted record not found.' });
    return this.prisma.dynamicModuleRecord.update({ where: { id }, data: { deletedAt: null } });
  }

  /**
   * If the module has an approval workflow and `toStatus` is "approved" or
   * "rejected", the decision is routed through `ApprovalWorkflowsService`
   * (which enforces the current step's gating role/permission). Any other
   * status change is direct, recorded via `AuditService`. This deliberately
   * does not model a full state-machine per status — see
   * docs/dynamic-modules/business-analysis.md for the scope line.
   */
  async changeStatus(tenantId: string, moduleDefinitionId: string, id: string, dto: ChangeDynamicModuleRecordStatusDto, user: AuthenticatedUser): Promise<DynamicModuleRecord> {
    this.assertPermission(user, moduleDefinitionId, 'approve');
    const definition = await this.definitions.findOne(tenantId, moduleDefinitionId);
    if (!definition.statuses.includes(dto.toStatus)) {
      throw new BadRequestException({ code: 'DYNAMIC_MODULE_INVALID_STATUS', message: `"${dto.toStatus}" is not a configured status for this module.` });
    }
    const record = await this.findRecordRaw(tenantId, moduleDefinitionId, id);
    if (record.status === dto.toStatus) {
      throw new BadRequestException({ code: 'DYNAMIC_MODULE_STATUS_UNCHANGED', message: 'The record already has this status.' });
    }

    const decisionEntityType = this.decisionEntityType(moduleDefinitionId);
    const isApprovalDecision = definition.approvalWorkflowId && (dto.toStatus === 'approved' || dto.toStatus === 'rejected');
    if (isApprovalDecision) {
      await this.approvalWorkflows.startRequest(tenantId, definition.approvalWorkflowId!, decisionEntityType, record.id);
      await this.approvalWorkflows.decide(tenantId, decisionEntityType, record.id, dto.toStatus as 'approved' | 'rejected', user, dto.reason);
    } else {
      await this.audit.record(tenantId, user.userId, 'dynamic_module_record.status_changed', decisionEntityType, record.id, {
        reason: dto.reason,
        previousValue: { status: record.status },
        newValue: { status: dto.toStatus },
      });
    }

    await this.prisma.dynamicModuleRecordStatusHistory.create({
      data: { tenantId, recordId: record.id, fromStatus: record.status, toStatus: dto.toStatus, changedByUserId: user.userId, reason: dto.reason },
    });

    return this.prisma.dynamicModuleRecord.update({ where: { id }, data: { status: dto.toStatus } });
  }

  async statusHistory(tenantId: string, moduleDefinitionId: string, id: string, user: AuthenticatedUser) {
    this.assertPermission(user, moduleDefinitionId, 'read');
    await this.findRecordRaw(tenantId, moduleDefinitionId, id);
    return this.prisma.dynamicModuleRecordStatusHistory.findMany({ where: { tenantId, recordId: id }, orderBy: { createdAt: 'asc' } });
  }

  async summary(tenantId: string, moduleDefinitionId: string, user: AuthenticatedUser) {
    this.assertPermission(user, moduleDefinitionId, 'read');
    const [byStatus, byBranch] = await Promise.all([
      this.prisma.dynamicModuleRecord.groupBy({ by: ['status'], where: { tenantId, moduleDefinitionId, deletedAt: null }, _count: true }),
      this.prisma.dynamicModuleRecord.groupBy({ by: ['branchId'], where: { tenantId, moduleDefinitionId, deletedAt: null }, _count: true }),
    ]);
    return {
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
      byBranch: byBranch.map((r) => ({ branchId: r.branchId, count: r._count })),
    };
  }

  private async findRecordRaw(tenantId: string, moduleDefinitionId: string, id: string): Promise<DynamicModuleRecord> {
    const record = await this.prisma.dynamicModuleRecord.findFirst({ where: { id, tenantId, moduleDefinitionId, deletedAt: null } });
    if (!record) throw new NotFoundException({ code: 'DYNAMIC_MODULE_RECORD_NOT_FOUND', message: 'Record not found.' });
    return record;
  }

  private async withCustomFields(tenantId: string, entityType: string, record: DynamicModuleRecord): Promise<DynamicModuleRecordWithFields> {
    const [customFields, contexts] = await Promise.all([
      this.customFields.getValues(tenantId, entityType, record.id),
      record.createdByUserId ? this.resolveCreatorContextsFor(tenantId, [record.createdByUserId]) : Promise.resolve(new Map<string, CreatorContext>()),
    ]);
    return { ...record, customFields, creatorContext: (record.createdByUserId && contexts.get(record.createdByUserId)) || null };
  }

  /**
   * Bulk-resolves each creator's own current branch/department/ministry in
   * as few queries as possible (never one query per record) — "the level
   * for the user who filled it" (§ dynamic-modules record display) is read
   * live from `User.assignedBranchId`/`assignedDepartmentRecordId` and any
   * `LeadershipAppointment` over a `ministry`, not from anything snapshotted
   * onto the record itself, so it always reflects the creator's current
   * assignment even if that's changed since they submitted.
   */
  private async resolveCreatorContextsFor(tenantId: string, userIds: string[]): Promise<Map<string, CreatorContext>> {
    const distinctIds = Array.from(new Set(userIds));
    if (distinctIds.length === 0) return new Map();

    const [users, appointments] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: distinctIds }, tenantId },
        select: { id: true, assignedBranchId: true, assignedDepartmentRecordId: true },
      }),
      this.prisma.leadershipAppointment.findMany({
        where: { tenantId, userId: { in: distinctIds }, targetEntityType: 'ministry' },
      }),
    ]);

    const branchIds = users.map((u) => u.assignedBranchId).filter((id): id is string => !!id);
    const departmentRecordIds = users.map((u) => u.assignedDepartmentRecordId).filter((id): id is string => !!id);
    const ministryIds = appointments.map((a) => a.targetEntityId);

    const [branches, departments, ministries] = await Promise.all([
      branchIds.length ? this.prisma.branch.findMany({ where: { id: { in: branchIds }, tenantId }, select: { id: true, name: true } }) : [],
      departmentRecordIds.length
        ? this.prisma.dynamicModuleRecord.findMany({ where: { id: { in: departmentRecordIds }, tenantId }, select: { id: true, title: true } })
        : [],
      ministryIds.length ? this.prisma.ministry.findMany({ where: { id: { in: ministryIds }, tenantId }, select: { id: true, name: true } }) : [],
    ]);

    const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
    const departmentTitleById = new Map(departments.map((d) => [d.id, d.title]));
    const ministryNameById = new Map(ministries.map((m) => [m.id, m.name]));
    const ministryTargetByUserId = new Map(appointments.map((a) => [a.userId, a.targetEntityId]));

    const result = new Map<string, CreatorContext>();
    for (const u of users) {
      const ministryTargetId = ministryTargetByUserId.get(u.id);
      result.set(u.id, {
        branchName: (u.assignedBranchId && branchNameById.get(u.assignedBranchId)) || null,
        departmentName: (u.assignedDepartmentRecordId && departmentTitleById.get(u.assignedDepartmentRecordId)) || null,
        ministryName: (ministryTargetId && ministryNameById.get(ministryTargetId)) || null,
      });
    }
    return result;
  }

  private assertPermission(user: AuthenticatedUser, moduleDefinitionId: string, action: 'create' | 'read' | 'update' | 'delete' | 'approve'): void {
    if (user.isPlatformAdmin) return;
    const code = `dynamicmodule.${moduleDefinitionId}.${action}`;
    if (!user.permissions.includes(code)) {
      throw new ForbiddenException({ code: 'PERMISSION_FORBIDDEN', message: `Requires permission: ${code}` });
    }
  }

  private hasStaticPermission(user: AuthenticatedUser, moduleDefinitionId: string, action: 'create' | 'read' | 'update' | 'delete' | 'approve'): boolean {
    return user.isPlatformAdmin || user.permissions.includes(`dynamicmodule.${moduleDefinitionId}.${action}`);
  }

  /**
   * Row-level read scoping (§15's "a superior leader sees everything, a
   * caller scoped to their own branch/department sees their own"). A caller
   * with the static per-module `read` permission (or platform admin) is
   * unrestricted, same as before this existed. Otherwise, they must have
   * reached this module through §13 eligibility (it was assigned to a scope
   * they belong to) — if not, no access at all, same as before. If so,
   * their view is restricted to: records they created themselves, records
   * under a branch they're scoped to, or records attached to a
   * department/ministry/etc. they're scoped to.
   */
  private async resolveReadScope(tenantId: string, moduleDefinitionId: string, user: AuthenticatedUser): Promise<ReadScope> {
    if (this.hasStaticPermission(user, moduleDefinitionId, 'read')) {
      return { restricted: false, callerId: user.userId, branchIds: [], otherScopeIds: [] };
    }

    const eligibleResources = await this.eligibilityResolver.resolveResourcesFor(tenantId, user.userId, FORM_RESOURCE_TYPE);
    if (!eligibleResources.some((r) => r.resourceKey === moduleDefinitionId)) {
      throw new ForbiddenException({ code: 'PERMISSION_FORBIDDEN', message: `Requires permission: dynamicmodule.${moduleDefinitionId}.read` });
    }

    const scopes = await this.eligibilityResolver.resolveScopesFor(tenantId, user.userId);
    const branchIds = scopes.filter((s) => s.scopeEntityType === 'branch').map((s) => s.scopeEntityId);
    // Everything else (department/ministry/other leadership targets) is matched against
    // `attachedToEntityId` by id alone — real row UUIDs are unique enough across every module
    // that checking the exact scopeEntityType prefix too would add complexity without adding safety.
    // `user_category` contributes nothing here: it's a resource-eligibility scope, not something
    // an individual record is ever "attached to."
    const otherScopeIds = scopes.filter((s) => s.scopeEntityType !== 'branch' && s.scopeEntityType !== 'user_category').map((s) => s.scopeEntityId);

    return { restricted: true, callerId: user.userId, branchIds, otherScopeIds };
  }

  private readScopeOrConditions(scope: ReadScope): Prisma.DynamicModuleRecordWhereInput[] {
    const conditions: Prisma.DynamicModuleRecordWhereInput[] = [{ createdByUserId: scope.callerId }];
    if (scope.branchIds.length > 0) conditions.push({ branchId: { in: scope.branchIds } });
    if (scope.otherScopeIds.length > 0) conditions.push({ attachedToEntityId: { in: scope.otherScopeIds } });
    return conditions;
  }

  private matchesReadScope(record: DynamicModuleRecord, scope: ReadScope): boolean {
    if (record.createdByUserId === scope.callerId) return true;
    if (record.branchId && scope.branchIds.includes(record.branchId)) return true;
    if (record.attachedToEntityId && scope.otherScopeIds.includes(record.attachedToEntityId)) return true;
    return false;
  }

  private fieldsEntityType(moduleDefinitionId: string): string {
    return `dynamicmodule:${moduleDefinitionId}`;
  }

  /** Distinct from fieldsEntityType — a record's approval-chain key, kept separate so "this record's fields" and "this record's approval state" are never accidentally conflated under the same generic (entityType, entityId) pair. */
  private decisionEntityType(moduleDefinitionId: string): string {
    return `dynamicmodule_record:${moduleDefinitionId}`;
  }
}
