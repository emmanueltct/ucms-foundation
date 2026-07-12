import { Test } from '@nestjs/testing';
import { EligibilityResolverService } from '../src/common/eligibility/eligibility-resolver.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { LeadershipScopeService } from '../src/common/leadership-scope/leadership-scope.service';

describe('EligibilityResolverService', () => {
  let service: EligibilityResolverService;

  const TENANT_ID = 'tenant-1';
  const USER_ID = 'user-1';

  const mockPrisma = {
    user: { findFirst: jest.fn(), findMany: jest.fn() },
    dynamicModuleDefinition: { findFirst: jest.fn() },
    dynamicModuleRecord: { findFirst: jest.fn(), findMany: jest.fn() },
    configItem: { findUnique: jest.fn(), findFirst: jest.fn() },
    branch: { findFirst: jest.fn(), findMany: jest.fn() },
    resourceAssignment: { findMany: jest.fn() },
    leadershipAppointment: { findMany: jest.fn() },
  };
  const mockLeadershipScope = { resolveAppointmentsFor: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLeadershipScope.resolveAppointmentsFor.mockResolvedValue([]);
    mockPrisma.leadershipAppointment.findMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        EligibilityResolverService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LeadershipScopeService, useValue: mockLeadershipScope },
      ],
    }).compile();
    service = moduleRef.get(EligibilityResolverService);
  });

  /** branch-c -> branch-b -> branch-a (root) */
  function mockBranchChain() {
    const chain: Record<string, any> = {
      'branch-c': { id: 'branch-c', parentBranchId: 'branch-b' },
      'branch-b': { id: 'branch-b', parentBranchId: 'branch-a' },
      'branch-a': { id: 'branch-a', parentBranchId: null },
    };
    mockPrisma.branch.findFirst.mockImplementation(async ({ where }: any) => chain[where.id] ?? null);
  }

  /** dept-c -> dept-b -> dept-a (root), all under moduleDefinitionId 'dept-module-1' */
  function mockDeptChain() {
    const chain: Record<string, any> = {
      'dept-c': { id: 'dept-c', parentRecordId: 'dept-b' },
      'dept-b': { id: 'dept-b', parentRecordId: 'dept-a' },
      'dept-a': { id: 'dept-a', parentRecordId: null },
    };
    mockPrisma.dynamicModuleRecord.findFirst.mockImplementation(async ({ where }: any) => chain[where.id] ?? null);
  }

  describe('resolveScopesFor', () => {
    it('returns an empty array when the user does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const scopes = await service.resolveScopesFor(TENANT_ID, USER_ID);
      expect(scopes).toEqual([]);
    });

    it('includes the branch plus its ancestors when assignedBranchId is set', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: 'branch-c', assignedDepartmentRecordId: null, userCategory: null });
      mockBranchChain();

      const scopes = await service.resolveScopesFor(TENANT_ID, USER_ID);

      expect(scopes).toEqual([
        { scopeEntityType: 'branch', scopeEntityId: 'branch-c' },
        { scopeEntityType: 'branch', scopeEntityId: 'branch-b' },
        { scopeEntityType: 'branch', scopeEntityId: 'branch-a' },
      ]);
    });

    it('includes the department plus its ancestors, resolved through the departments module definition', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: null, assignedDepartmentRecordId: 'dept-c', userCategory: null });
      mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue({ id: 'dept-module-1' });
      mockDeptChain();

      const scopes = await service.resolveScopesFor(TENANT_ID, USER_ID);

      expect(scopes).toEqual([
        { scopeEntityType: 'dynamic_module_record', scopeEntityId: 'dept-c' },
        { scopeEntityType: 'dynamic_module_record', scopeEntityId: 'dept-b' },
        { scopeEntityType: 'dynamic_module_record', scopeEntityId: 'dept-a' },
      ]);
    });

    it('skips department-ancestor resolution when no departments module exists for this tenant', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: null, assignedDepartmentRecordId: 'dept-c', userCategory: null });
      mockPrisma.dynamicModuleDefinition.findFirst.mockResolvedValue(null);

      const scopes = await service.resolveScopesFor(TENANT_ID, USER_ID);

      expect(mockPrisma.dynamicModuleRecord.findFirst).not.toHaveBeenCalled();
      expect(scopes).toEqual([{ scopeEntityType: 'dynamic_module_record', scopeEntityId: 'dept-c' }]);
    });

    it('includes every leadership appointment target', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: null, assignedDepartmentRecordId: null, userCategory: null });
      mockLeadershipScope.resolveAppointmentsFor.mockResolvedValue([
        { targetEntityType: 'branch', targetEntityId: 'branch-x' },
        { targetEntityType: 'dynamic_module_record', targetEntityId: 'ministry-y' },
      ]);

      const scopes = await service.resolveScopesFor(TENANT_ID, USER_ID);

      expect(scopes).toEqual([
        { scopeEntityType: 'branch', scopeEntityId: 'branch-x' },
        { scopeEntityType: 'dynamic_module_record', scopeEntityId: 'ministry-y' },
      ]);
    });

    it('includes the resolved user_category ConfigItem when userCategory is set', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: null, assignedDepartmentRecordId: null, userCategory: 'staff' });
      mockPrisma.configItem.findUnique.mockResolvedValue({ id: 'config-item-staff' });

      const scopes = await service.resolveScopesFor(TENANT_ID, USER_ID);

      expect(mockPrisma.configItem.findUnique).toHaveBeenCalledWith({
        where: { tenantId_namespace_key: { tenantId: TENANT_ID, namespace: 'user_category', key: 'staff' } },
      });
      expect(scopes).toEqual([{ scopeEntityType: 'user_category', scopeEntityId: 'config-item-staff' }]);
    });
  });

  describe('resolveResourcesFor', () => {
    it('unions resources across every resolved scope, deduplicated by assignment id', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ assignedBranchId: 'branch-a', assignedDepartmentRecordId: null, userCategory: null });
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-a', parentBranchId: null });
      mockLeadershipScope.resolveAppointmentsFor.mockResolvedValue([{ targetEntityType: 'branch', targetEntityId: 'branch-a' }]);
      mockPrisma.resourceAssignment.findMany.mockResolvedValue([{ id: 'ra-1', resourceType: 'dynamic_module_definition', resourceKey: 'form-1' }]);

      const results = await service.resolveResourcesFor(TENANT_ID, USER_ID, 'dynamic_module_definition');

      // Both resolved scopes point at branch-a, but the same assignment (ra-1) must only appear once.
      expect(results).toEqual([{ id: 'ra-1', resourceType: 'dynamic_module_definition', resourceKey: 'form-1' }]);
    });
  });

  describe('resolveUsersEligibleForScope', () => {
    it('for a branch scope, includes users assigned to it or any of its descendants', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([
        { id: 'branch-b', parentBranchId: 'branch-a' },
        { id: 'branch-c', parentBranchId: 'branch-b' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);

      const userIds = await service.resolveUsersEligibleForScope(TENANT_ID, 'branch', 'branch-a');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, assignedBranchId: { in: ['branch-a', 'branch-b', 'branch-c'] } } }),
      );
      expect(userIds).toEqual(['user-1', 'user-2']);
    });

    it('for a dynamic_module_record scope, includes users assigned to it or any of its descendants', async () => {
      mockPrisma.dynamicModuleRecord.findFirst.mockResolvedValue({ moduleDefinitionId: 'dept-module-1' });
      mockPrisma.dynamicModuleRecord.findMany.mockResolvedValue([{ id: 'dept-child', parentRecordId: 'dept-parent' }]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

      const userIds = await service.resolveUsersEligibleForScope(TENANT_ID, 'dynamic_module_record', 'dept-parent');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, assignedDepartmentRecordId: { in: ['dept-parent', 'dept-child'] } } }),
      );
      expect(userIds).toEqual(['user-1']);
    });

    it('for a user_category scope, includes every user with that category', async () => {
      mockPrisma.configItem.findFirst.mockResolvedValue({ id: 'config-item-1', key: 'staff' });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);

      const userIds = await service.resolveUsersEligibleForScope(TENANT_ID, 'user_category', 'config-item-1');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: TENANT_ID, userCategory: 'staff' } }));
      expect(userIds).toEqual(['user-1']);
    });

    it('always includes every user with a direct LeadershipAppointment over the scope, in addition to roll-up matches', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.leadershipAppointment.findMany.mockResolvedValue([{ userId: 'leader-1' }]);

      const userIds = await service.resolveUsersEligibleForScope(TENANT_ID, 'branch', 'branch-a');

      expect(userIds).toEqual(['leader-1']);
    });

    it('deduplicates a user reached both via roll-up and a direct leadership appointment', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
      mockPrisma.leadershipAppointment.findMany.mockResolvedValue([{ userId: 'user-1' }]);

      const userIds = await service.resolveUsersEligibleForScope(TENANT_ID, 'branch', 'branch-a');

      expect(userIds).toEqual(['user-1']);
    });
  });
});
