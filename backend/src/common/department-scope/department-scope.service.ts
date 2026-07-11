import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DynamicModuleRecordsService } from '../../dynamic-modules/dynamic-module-records.service';
import { AuthenticatedUser } from '../interfaces/request-context.interface';

/** The one moduleDefinitionId departments live under — see `departments.service.ts`. */
const DEPARTMENTS_MODULE_KEY = 'departments';

/**
 * Department-scoped visibility roll-up — mirrors `BranchScopeService` 1:1,
 * but for `User.assignedDepartmentRecordId`. Deliberately independent of
 * branch scope (a user can have either, both, or neither — see design
 * decision in the platform-admin business-analysis doc); this service never
 * assumes one implies the other.
 */
@Injectable()
export class DepartmentScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly records: DynamicModuleRecordsService,
  ) {}

  /**
   * Returns the set of department record ids a user may see, or `null`
   * meaning "unrestricted" (the default — `User.assignedDepartmentRecordId`
   * is nullable and unset by default, so tenants that never assign
   * department scope are entirely unaffected by this mechanism existing).
   * Includes descendants of the user's own department (sub-departments),
   * mirroring `BranchScopeService.resolveVisibleBranchIds`'s
   * parent-plus-descendants shape exactly.
   */
  async resolveVisibleDepartmentRecordIds(tenantId: string, userId: string): Promise<string[] | null> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId }, select: { assignedDepartmentRecordId: true } });
    if (!user?.assignedDepartmentRecordId) return null;

    const definition = await this.prisma.dynamicModuleDefinition.findFirst({ where: { tenantId, key: DEPARTMENTS_MODULE_KEY } });
    if (!definition) return [user.assignedDepartmentRecordId];

    const descendants = await this.records.descendants(tenantId, definition.id, user.assignedDepartmentRecordId, this.internalCaller());
    return [user.assignedDepartmentRecordId, ...descendants.map((d) => d.id)];
  }

  /** Whether `userId` is the leader of `departmentRecordId` — the row-level check that turns a module-wide `dynamicmodule.{id}.update` grant into scoped-to-one-department access. */
  async isLeaderOf(tenantId: string, userId: string, departmentRecordId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { assignedDepartmentRecordId: true, departmentRole: true },
    });
    return user?.departmentRole === 'leader' && user.assignedDepartmentRecordId === departmentRecordId;
  }

  /** `DynamicModuleRecordsService.descendants` requires an `AuthenticatedUser` for its own permission check — this internal read is always platform-admin-equivalent since it's resolving scope, not exposing data directly to an end caller. */
  private internalCaller(): AuthenticatedUser {
    return { userId: 'system', tenantId: '', email: '', isPlatformAdmin: true, permissions: [], roles: [] };
  }
}
