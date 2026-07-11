import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DynamicModuleRecord } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalWorkflowsService } from '../approval-workflows/approval-workflows.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { DynamicModuleDefinitionsService } from './dynamic-module-definitions.service';
import { CreateDynamicModuleRecordDto } from './dto/create-dynamic-module-record.dto';
import { UpdateDynamicModuleRecordDto } from './dto/update-dynamic-module-record.dto';
import { ChangeDynamicModuleRecordStatusDto } from './dto/change-status.dto';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

export type DynamicModuleRecordWithFields = DynamicModuleRecord & { customFields: Record<string, unknown> };

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

  async findAll(
    tenantId: string,
    moduleDefinitionId: string,
    query: { attachedToEntityType?: string; attachedToEntityId?: string; status?: string; branchId?: string },
    user: AuthenticatedUser,
  ): Promise<DynamicModuleRecordWithFields[]> {
    this.assertPermission(user, moduleDefinitionId, 'read');
    const records = await this.prisma.dynamicModuleRecord.findMany({
      where: {
        tenantId,
        moduleDefinitionId,
        deletedAt: null,
        ...(query.attachedToEntityType ? { attachedToEntityType: query.attachedToEntityType } : {}),
        ...(query.attachedToEntityId ? { attachedToEntityId: query.attachedToEntityId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const entityType = this.fieldsEntityType(moduleDefinitionId);
    const valuesByRecord = await this.customFields.getValuesForMany(tenantId, entityType, records.map((r) => r.id));
    return records.map((r) => ({ ...r, customFields: valuesByRecord[r.id] ?? {} }));
  }

  async findOne(tenantId: string, moduleDefinitionId: string, id: string, user: AuthenticatedUser): Promise<DynamicModuleRecordWithFields> {
    this.assertPermission(user, moduleDefinitionId, 'read');
    const record = await this.findRecordRaw(tenantId, moduleDefinitionId, id);
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

  async softDelete(tenantId: string, moduleDefinitionId: string, id: string, user: AuthenticatedUser): Promise<DynamicModuleRecord> {
    this.assertPermission(user, moduleDefinitionId, 'delete');
    await this.findRecordRaw(tenantId, moduleDefinitionId, id);
    return this.prisma.dynamicModuleRecord.update({ where: { id }, data: { deletedAt: new Date() } });
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
    const customFields = await this.customFields.getValues(tenantId, entityType, record.id);
    return { ...record, customFields };
  }

  private assertPermission(user: AuthenticatedUser, moduleDefinitionId: string, action: 'create' | 'read' | 'update' | 'delete' | 'approve'): void {
    if (user.isPlatformAdmin) return;
    const code = `dynamicmodule.${moduleDefinitionId}.${action}`;
    if (!user.permissions.includes(code)) {
      throw new ForbiddenException({ code: 'PERMISSION_FORBIDDEN', message: `Requires permission: ${code}` });
    }
  }

  private fieldsEntityType(moduleDefinitionId: string): string {
    return `dynamicmodule:${moduleDefinitionId}`;
  }

  /** Distinct from fieldsEntityType — a record's approval-chain key, kept separate so "this record's fields" and "this record's approval state" are never accidentally conflated under the same generic (entityType, entityId) pair. */
  private decisionEntityType(moduleDefinitionId: string): string {
    return `dynamicmodule_record:${moduleDefinitionId}`;
  }
}
