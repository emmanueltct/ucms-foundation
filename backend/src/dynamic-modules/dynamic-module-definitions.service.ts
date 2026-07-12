import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DynamicModuleDefinition } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalWorkflowsService } from '../approval-workflows/approval-workflows.service';
import { CreateDynamicModuleDefinitionDto } from './dto/create-dynamic-module-definition.dto';
import { UpdateDynamicModuleDefinitionDto } from './dto/update-dynamic-module-definition.dto';

const RECORD_ACTIONS = ['create', 'read', 'update', 'delete', 'approve'] as const;

/**
 * Lets a Church Administrator define an entirely new functional module — no
 * code change required. See docs/dynamic-modules/business-analysis.md.
 *
 * Deliberately breaks the "Permission rows are only ever added by migration"
 * convention documented on the `Permission` model itself: a module built in
 * the UI has no migration to add its permission codes in, so `create()`
 * appends them programmatically instead, namespaced by this definition's own
 * (globally unique) id — `dynamicmodule.{id}.{action}` — so codes can never
 * collide across tenants or across two modules in the same tenant.
 */
@Injectable()
export class DynamicModuleDefinitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalWorkflows: ApprovalWorkflowsService,
  ) {}

  async create(tenantId: string, dto: CreateDynamicModuleDefinitionDto): Promise<DynamicModuleDefinition> {
    const existing = await this.prisma.dynamicModuleDefinition.findUnique({ where: { tenantId_key: { tenantId, key: dto.key } } });
    if (existing) {
      throw new ConflictException({ code: 'DYNAMIC_MODULE_KEY_TAKEN', message: `A module with key "${dto.key}" already exists.` });
    }
    if (dto.approvalWorkflowId) {
      await this.approvalWorkflows.findOne(tenantId, dto.approvalWorkflowId);
    }

    const definition = await this.prisma.dynamicModuleDefinition.create({
      data: {
        tenantId,
        key: dto.key,
        label: dto.label,
        description: dto.description,
        icon: dto.icon,
        attachableToEntityTypes: dto.attachableToEntityTypes ?? [],
        statuses: dto.statuses ?? undefined, // let the column default (["open","closed"]) apply when omitted
        approvalWorkflowId: dto.approvalWorkflowId,
        showInNav: dto.showInNav ?? false,
        allowPublicSubmission: dto.allowPublicSubmission ?? false,
        allowMemberAttachment: dto.allowMemberAttachment ?? false,
      },
    });

    await this.grantPermissions(tenantId, definition.id, definition.label);

    return definition;
  }

  async findAll(tenantId: string, query: { showInNav?: boolean; includeInactive?: boolean } = {}): Promise<DynamicModuleDefinition[]> {
    return this.prisma.dynamicModuleDefinition.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.showInNav !== undefined ? { showInNav: query.showInNav } : {}),
      },
      orderBy: { label: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<DynamicModuleDefinition> {
    const definition = await this.prisma.dynamicModuleDefinition.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!definition) {
      throw new NotFoundException({ code: 'DYNAMIC_MODULE_NOT_FOUND', message: 'Dynamic module not found.' });
    }
    return definition;
  }

  async findByKey(tenantId: string, key: string): Promise<DynamicModuleDefinition> {
    const definition = await this.prisma.dynamicModuleDefinition.findFirst({ where: { key, tenantId, deletedAt: null } });
    if (!definition) {
      throw new NotFoundException({ code: 'DYNAMIC_MODULE_NOT_FOUND', message: 'Dynamic module not found.' });
    }
    return definition;
  }

  async update(tenantId: string, id: string, dto: UpdateDynamicModuleDefinitionDto): Promise<DynamicModuleDefinition> {
    await this.findOne(tenantId, id);
    if (dto.approvalWorkflowId) {
      await this.approvalWorkflows.findOne(tenantId, dto.approvalWorkflowId);
    }
    if (dto.statuses && dto.statuses.length === 0) {
      throw new BadRequestException({ code: 'DYNAMIC_MODULE_STATUSES_REQUIRED', message: 'A module must have at least one status.' });
    }
    return this.prisma.dynamicModuleDefinition.update({
      where: { id },
      data: {
        label: dto.label,
        description: dto.description,
        icon: dto.icon,
        attachableToEntityTypes: dto.attachableToEntityTypes,
        statuses: dto.statuses,
        approvalWorkflowId: dto.approvalWorkflowId,
        showInNav: dto.showInNav,
        allowPublicSubmission: dto.allowPublicSubmission,
        allowMemberAttachment: dto.allowMemberAttachment,
        isActive: dto.isActive,
      },
    });
  }

  async softDelete(tenantId: string, id: string): Promise<DynamicModuleDefinition> {
    await this.findOne(tenantId, id);
    return this.prisma.dynamicModuleDefinition.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Grants the newly-created permission codes to every system role (e.g. "Church Administrator") in this tenant — the same bootstrap TenantsService already does for migration-seeded codes. */
  private async grantPermissions(tenantId: string, definitionId: string, label: string): Promise<void> {
    const codes = RECORD_ACTIONS.map((action) => ({
      code: `dynamicmodule.${definitionId}.${action}`,
      module: `dynamic_module:${definitionId}`,
      description: `${action[0].toUpperCase()}${action.slice(1)} ${label} records`,
    }));

    await this.prisma.permission.createMany({ data: codes, skipDuplicates: true });
    const created = await this.prisma.permission.findMany({ where: { code: { in: codes.map((c) => c.code) } } });

    const systemRoles = await this.prisma.role.findMany({ where: { tenantId, isSystem: true } });
    if (systemRoles.length === 0) return;

    await this.prisma.rolePermission.createMany({
      data: systemRoles.flatMap((role) => created.map((permission) => ({ roleId: role.id, permissionId: permission.id }))),
      skipDuplicates: true,
    });
  }
}
