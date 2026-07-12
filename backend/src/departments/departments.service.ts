import { ForbiddenException, Injectable } from '@nestjs/common';
import { DynamicModuleDefinitionsService } from '../dynamic-modules/dynamic-module-definitions.service';
import { DynamicModuleRecordsService } from '../dynamic-modules/dynamic-module-records.service';
import { ResourceAssignmentsService } from '../resource-assignments/resource-assignments.service';
import { DepartmentScopeService } from '../common/department-scope/department-scope.service';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AssignDepartmentResourceDto } from './dto/assign-department-resource.dto';

/** The fixed key every tenant's pre-seeded departments module is created under — see TenantsService.bootstrapAdminUser. */
export const DEPARTMENTS_MODULE_KEY = 'departments';

/** `ResourceAssignment.scopeEntityType` used for every department (any Dynamic Module Record can be a scope, not just departments). */
const SCOPE_ENTITY_TYPE = 'dynamic_module_record';

/**
 * Departments are Dynamic Module Records under one pre-seeded, per-tenant
 * "departments" `DynamicModuleDefinition` — not a new model (see design
 * decision in the platform-admin business-analysis doc). This thin wrapper
 * resolves that module by its fixed key rather than trusting a
 * client-supplied `moduleDefinitionId` (the "module-key assertion" — every
 * Departments route is guaranteed to operate on the tenant's one real
 * departments module), then delegates to `DynamicModuleRecordsService` /
 * `ResourceAssignmentsService` for everything else — the same layering
 * `MembersController` already uses over generic patterns rather than
 * special-casing department semantics inside the generic Dynamic Module
 * controller.
 */
@Injectable()
export class DepartmentsService {
  constructor(
    private readonly definitions: DynamicModuleDefinitionsService,
    private readonly records: DynamicModuleRecordsService,
    private readonly resourceAssignments: ResourceAssignmentsService,
    private readonly departmentScope: DepartmentScopeService,
  ) {}

  async create(tenantId: string, dto: CreateDepartmentDto, user: AuthenticatedUser) {
    const moduleDefinitionId = await this.moduleDefinitionId(tenantId);
    return this.records.create(
      tenantId,
      moduleDefinitionId,
      { title: dto.name, parentRecordId: dto.parentDepartmentId, customFields: dto.customFields },
      user,
    );
  }

  async findAll(tenantId: string, user: AuthenticatedUser) {
    const moduleDefinitionId = await this.moduleDefinitionId(tenantId);
    return this.records.findAll(tenantId, moduleDefinitionId, {}, user);
  }

  async findOne(tenantId: string, id: string, user: AuthenticatedUser) {
    const moduleDefinitionId = await this.moduleDefinitionId(tenantId);
    return this.records.findOne(tenantId, moduleDefinitionId, id, user);
  }

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto, user: AuthenticatedUser) {
    const moduleDefinitionId = await this.moduleDefinitionId(tenantId);
    return this.records.update(
      tenantId,
      moduleDefinitionId,
      id,
      { title: dto.name, parentRecordId: dto.parentDepartmentId, customFields: dto.customFields },
      user,
    );
  }

  async remove(tenantId: string, id: string, user: AuthenticatedUser) {
    const moduleDefinitionId = await this.moduleDefinitionId(tenantId);
    return this.records.softDelete(tenantId, moduleDefinitionId, id, user);
  }

  async listResources(tenantId: string, id: string, user: AuthenticatedUser) {
    const moduleDefinitionId = await this.moduleDefinitionId(tenantId);
    await this.records.findOne(tenantId, moduleDefinitionId, id, user); // 404s / permission-checks via the same path as any other read
    return this.resourceAssignments.resolveForScope(tenantId, SCOPE_ENTITY_TYPE, id);
  }

  async assignResource(tenantId: string, id: string, dto: AssignDepartmentResourceDto, user: AuthenticatedUser) {
    const moduleDefinitionId = await this.moduleDefinitionId(tenantId);
    await this.records.findOne(tenantId, moduleDefinitionId, id, user);
    await this.assertLeaderOf(tenantId, user, moduleDefinitionId, id);
    return this.resourceAssignments.create(tenantId, {
      scopeEntityType: SCOPE_ENTITY_TYPE,
      scopeEntityId: id,
      resourceType: dto.resourceType,
      resourceKey: dto.resourceKey,
      dueAt: dto.dueAt,
    });
  }

  async removeResource(tenantId: string, id: string, assignmentId: string, user: AuthenticatedUser) {
    const moduleDefinitionId = await this.moduleDefinitionId(tenantId);
    await this.records.findOne(tenantId, moduleDefinitionId, id, user);
    await this.assertLeaderOf(tenantId, user, moduleDefinitionId, id);
    return this.resourceAssignments.remove(tenantId, assignmentId);
  }

  private async moduleDefinitionId(tenantId: string): Promise<string> {
    const definition = await this.definitions.findByKey(tenantId, DEPARTMENTS_MODULE_KEY);
    return definition.id;
  }

  /**
   * `dynamicmodule.{moduleDefinitionId}.update`-style permissions are
   * scoped to the whole departments *module* (every department shares one
   * moduleDefinitionId) — a role with that permission can manage every
   * department, not just one, which is correct for a Church Administrator
   * but too broad for a Department Leader who should only manage their own.
   * This is the row-level check that turns the module-wide grant into
   * scoped-to-one-department access: allow if the caller has the
   * module-wide permission (or is a platform admin) OR is specifically the
   * leader of *this* department.
   */
  private async assertLeaderOf(tenantId: string, user: AuthenticatedUser, moduleDefinitionId: string, departmentRecordId: string): Promise<void> {
    if (user.isPlatformAdmin) return;
    if (user.permissions.includes(`dynamicmodule.${moduleDefinitionId}.update`)) return;
    if (await this.departmentScope.isLeaderOf(tenantId, user.userId, departmentRecordId)) return;

    throw new ForbiddenException({
      code: 'DEPARTMENT_LEADER_FORBIDDEN',
      message: 'You can only manage resources for a department you lead.',
    });
  }
}
