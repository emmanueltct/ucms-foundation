import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DynamicModuleRecordsService } from '../src/dynamic-modules/dynamic-module-records.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { ApprovalWorkflowsService } from '../src/approval-workflows/approval-workflows.service';
import { CustomFieldsService } from '../src/custom-fields/custom-fields.service';
import { DynamicModuleDefinitionsService } from '../src/dynamic-modules/dynamic-module-definitions.service';
import { ConfigService } from '../src/config-engine/config.service';
import { EligibilityResolverService } from '../src/common/eligibility/eligibility-resolver.service';

describe('DynamicModuleRecordsService', () => {
  let service: DynamicModuleRecordsService;

  const TENANT_ID = 'tenant-1';
  const MODULE_ID = 'def-1';

  const userWithAll = {
    userId: 'user-1',
    tenantId: TENANT_ID,
    email: 'a@b.com',
    isPlatformAdmin: false,
    roles: [],
    permissions: [
      `dynamicmodule.${MODULE_ID}.create`,
      `dynamicmodule.${MODULE_ID}.read`,
      `dynamicmodule.${MODULE_ID}.update`,
      `dynamicmodule.${MODULE_ID}.delete`,
      `dynamicmodule.${MODULE_ID}.approve`,
    ],
  };
  const userWithNone = { ...userWithAll, permissions: [] };

  const mockPrisma = {
    dynamicModuleRecord: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
    dynamicModuleRecordStatusHistory: { create: jest.fn(), findMany: jest.fn() },
    user: { findMany: jest.fn() },
    branch: { findMany: jest.fn() },
    ministry: { findMany: jest.fn() },
    leadershipAppointment: { findMany: jest.fn() },
  };

  const mockAudit = { record: jest.fn() };
  const mockApprovalWorkflows = { startRequest: jest.fn(), decide: jest.fn() };
  const mockCustomFields = { assertRequiredFieldsProvided: jest.fn(), setValues: jest.fn(), getValues: jest.fn().mockResolvedValue({}), getValuesForMany: jest.fn().mockResolvedValue({}) };
  const mockDefinitions = { findOne: jest.fn(), findByKey: jest.fn() };
  const mockConfig = { isFeatureEnabled: jest.fn() };
  const mockEligibilityResolver = { resolveResourcesFor: jest.fn(), resolveScopesFor: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCustomFields.getValues.mockResolvedValue({});
    mockCustomFields.getValuesForMany.mockResolvedValue({});
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.branch.findMany.mockResolvedValue([]);
    mockPrisma.ministry.findMany.mockResolvedValue([]);
    mockPrisma.leadershipAppointment.findMany.mockResolvedValue([]);
    mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([]);
    mockEligibilityResolver.resolveScopesFor.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        DynamicModuleRecordsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: ApprovalWorkflowsService, useValue: mockApprovalWorkflows },
        { provide: CustomFieldsService, useValue: mockCustomFields },
        { provide: DynamicModuleDefinitionsService, useValue: mockDefinitions },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EligibilityResolverService, useValue: mockEligibilityResolver },
      ],
    }).compile();
    service = moduleRef.get(DynamicModuleRecordsService);
  });

  describe('permission checks', () => {
    it('rejects create without the dynamic create permission', async () => {
      await expect(service.create(TENANT_ID, MODULE_ID, {} as any, userWithNone)).rejects.toThrow(ForbiddenException);
    });

    it('allows a platform admin regardless of permissions', async () => {
      mockDefinitions.findOne.mockResolvedValue({ id: MODULE_ID, statuses: ['open', 'closed'] });
      mockPrisma.dynamicModuleRecord.create.mockResolvedValue({ id: 'rec-1', status: 'open' });
      const platformAdmin = { ...userWithNone, isPlatformAdmin: true };
      await expect(service.create(TENANT_ID, MODULE_ID, {} as any, platformAdmin)).resolves.toBeDefined();
    });
  });

  describe('create', () => {
    it('defaults status to the module\'s first configured status', async () => {
      mockDefinitions.findOne.mockResolvedValue({ id: MODULE_ID, statuses: ['draft', 'open', 'closed'] });
      mockPrisma.dynamicModuleRecord.create.mockResolvedValue({ id: 'rec-1', status: 'draft' });

      await service.create(TENANT_ID, MODULE_ID, {}, userWithAll);

      expect(mockPrisma.dynamicModuleRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'draft' }) }),
      );
      expect(mockPrisma.dynamicModuleRecordStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fromStatus: null, toStatus: 'draft' }) }),
      );
    });

    it('validates required custom fields before creating', async () => {
      mockDefinitions.findOne.mockResolvedValue({ id: MODULE_ID, statuses: ['open'] });
      mockCustomFields.assertRequiredFieldsProvided.mockRejectedValue(new BadRequestException('missing'));
      await expect(service.create(TENANT_ID, MODULE_ID, {}, userWithAll)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.dynamicModuleRecord.create).not.toHaveBeenCalled();
    });
  });

  describe('createPublic', () => {
    const MODULE_KEY = 'prayer-requests';

    it('rejects when the module has allowPublicSubmission disabled', async () => {
      mockDefinitions.findByKey.mockResolvedValue({ id: MODULE_ID, statuses: ['open'], allowPublicSubmission: false });
      await expect(service.createPublic(TENANT_ID, MODULE_KEY, {})).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.dynamicModuleRecord.create).not.toHaveBeenCalled();
    });

    it('rejects when the tenant-wide guest_access.dynamic_modules feature toggle is off, even if the module allows it', async () => {
      mockDefinitions.findByKey.mockResolvedValue({ id: MODULE_ID, statuses: ['open'], allowPublicSubmission: true });
      mockConfig.isFeatureEnabled.mockResolvedValue(false);
      await expect(service.createPublic(TENANT_ID, MODULE_KEY, {})).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.dynamicModuleRecord.create).not.toHaveBeenCalled();
    });

    it('creates a record with no createdByUserId when both switches are on', async () => {
      mockDefinitions.findByKey.mockResolvedValue({ id: MODULE_ID, statuses: ['open', 'closed'], allowPublicSubmission: true });
      mockConfig.isFeatureEnabled.mockResolvedValue(true);
      mockCustomFields.assertRequiredFieldsProvided.mockResolvedValue(undefined);
      mockPrisma.dynamicModuleRecord.create.mockResolvedValue({ id: 'rec-1', status: 'open' });

      await service.createPublic(TENANT_ID, MODULE_KEY, { title: 'Please pray for my family' });

      expect(mockPrisma.dynamicModuleRecord.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT_ID,
          moduleDefinitionId: MODULE_ID,
          status: 'open',
          title: 'Please pray for my family',
          branchId: undefined,
        },
      });
      expect(mockPrisma.dynamicModuleRecordStatusHistory.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT_ID, recordId: 'rec-1', fromStatus: null, toStatus: 'open' },
      });
    });
  });

  describe('changeStatus', () => {
    it('rejects a status not configured on the module', async () => {
      mockDefinitions.findOne.mockResolvedValue({ id: MODULE_ID, statuses: ['open', 'closed'], approvalWorkflowId: null });
      mockPrisma.dynamicModuleRecord.findFirst.mockResolvedValue({ id: 'rec-1', status: 'open' });
      await expect(
        service.changeStatus(TENANT_ID, MODULE_ID, 'rec-1', { toStatus: 'not-a-status', reason: 'because' } as any, userWithAll),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the record already has the target status', async () => {
      mockDefinitions.findOne.mockResolvedValue({ id: MODULE_ID, statuses: ['open', 'closed'], approvalWorkflowId: null });
      mockPrisma.dynamicModuleRecord.findFirst.mockResolvedValue({ id: 'rec-1', status: 'open' });
      await expect(
        service.changeStatus(TENANT_ID, MODULE_ID, 'rec-1', { toStatus: 'open', reason: 'because' } as any, userWithAll),
      ).rejects.toThrow(BadRequestException);
    });

    it('records directly via AuditService when no approval workflow is configured', async () => {
      mockDefinitions.findOne.mockResolvedValue({ id: MODULE_ID, statuses: ['open', 'closed'], approvalWorkflowId: null });
      mockPrisma.dynamicModuleRecord.findFirst.mockResolvedValue({ id: 'rec-1', status: 'open' });
      mockPrisma.dynamicModuleRecord.update.mockResolvedValue({ id: 'rec-1', status: 'closed' });

      await service.changeStatus(TENANT_ID, MODULE_ID, 'rec-1', { toStatus: 'closed', reason: 'Cycle ended.' } as any, userWithAll);

      expect(mockApprovalWorkflows.decide).not.toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        TENANT_ID,
        'user-1',
        'dynamic_module_record.status_changed',
        `dynamicmodule_record:${MODULE_ID}`,
        'rec-1',
        expect.objectContaining({ reason: 'Cycle ended.' }),
      );
    });

    it('routes approved/rejected through ApprovalWorkflowsService when a workflow is configured', async () => {
      mockDefinitions.findOne.mockResolvedValue({ id: MODULE_ID, statuses: ['open', 'approved', 'rejected'], approvalWorkflowId: 'wf-1' });
      mockPrisma.dynamicModuleRecord.findFirst.mockResolvedValue({ id: 'rec-1', status: 'open' });
      mockPrisma.dynamicModuleRecord.update.mockResolvedValue({ id: 'rec-1', status: 'approved' });

      await service.changeStatus(TENANT_ID, MODULE_ID, 'rec-1', { toStatus: 'approved', reason: 'Looks good.' } as any, userWithAll);

      expect(mockApprovalWorkflows.startRequest).toHaveBeenCalledWith(TENANT_ID, 'wf-1', `dynamicmodule_record:${MODULE_ID}`, 'rec-1');
      expect(mockApprovalWorkflows.decide).toHaveBeenCalledWith(TENANT_ID, `dynamicmodule_record:${MODULE_ID}`, 'rec-1', 'approved', userWithAll, 'Looks good.');
      expect(mockAudit.record).not.toHaveBeenCalled();
    });
  });

  describe('ancestors', () => {
    const recordsById: Record<string, any> = {
      a: { id: 'a', tenantId: TENANT_ID, moduleDefinitionId: MODULE_ID, parentRecordId: null },
      b: { id: 'b', tenantId: TENANT_ID, moduleDefinitionId: MODULE_ID, parentRecordId: 'a' },
      c: { id: 'c', tenantId: TENANT_ID, moduleDefinitionId: MODULE_ID, parentRecordId: 'b' },
    };

    beforeEach(() => {
      mockPrisma.dynamicModuleRecord.findFirst.mockImplementation(async ({ where }: any) => recordsById[where.id] ?? null);
    });

    it('returns the chain from immediate parent up to the root', async () => {
      const ancestors = await service.ancestors(TENANT_ID, MODULE_ID, 'c', userWithAll);
      expect(ancestors.map((a) => a.id)).toEqual(['b', 'a']);
    });

    it('returns an empty array for a root record', async () => {
      const ancestors = await service.ancestors(TENANT_ID, MODULE_ID, 'a', userWithAll);
      expect(ancestors).toEqual([]);
    });

    it('rejects a caller without the module read permission', async () => {
      await expect(service.ancestors(TENANT_ID, MODULE_ID, 'c', userWithNone)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('creatorContext resolution', () => {
    it('findAll resolves each creator\'s current branch/department/ministry in one batch, not one query per record', async () => {
      mockPrisma.dynamicModuleRecord.findMany.mockResolvedValueOnce([
        { id: 'rec-1', createdByUserId: 'creator-1' },
        { id: 'rec-2', createdByUserId: 'creator-2' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'creator-1', assignedBranchId: 'branch-1', assignedDepartmentRecordId: null },
        { id: 'creator-2', assignedBranchId: null, assignedDepartmentRecordId: null },
      ]);
      mockPrisma.branch.findMany.mockResolvedValue([{ id: 'branch-1', name: 'Gisozi Branch' }]);
      mockPrisma.leadershipAppointment.findMany.mockResolvedValue([{ userId: 'creator-2', targetEntityId: 'ministry-1' }]);
      mockPrisma.ministry.findMany.mockResolvedValue([{ id: 'ministry-1', name: 'Choir' }]);

      const results = await service.findAll(TENANT_ID, MODULE_ID, {}, userWithAll);

      // Exactly one dynamicModuleRecord.findMany call — the record list itself; no department
      // is assigned to either creator here, so resolveCreatorContextsFor never needs a second one.
      expect(mockPrisma.dynamicModuleRecord.findMany).toHaveBeenCalledTimes(1);
      expect(results[0].creatorContext).toEqual({ branchName: 'Gisozi Branch', departmentName: null, ministryName: null });
      expect(results[1].creatorContext).toEqual({ branchName: null, departmentName: null, ministryName: 'Choir' });
      expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
    });

    it('findOne returns creatorContext: null when the record has no createdByUserId', async () => {
      mockPrisma.dynamicModuleRecord.findFirst.mockResolvedValue({ id: 'rec-1', createdByUserId: null });

      const result = await service.findOne(TENANT_ID, MODULE_ID, 'rec-1', userWithAll);

      expect(result.creatorContext).toBeNull();
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('resolves departmentName from the department DynamicModuleRecord\'s title', async () => {
      mockPrisma.dynamicModuleRecord.findFirst.mockResolvedValue({ id: 'rec-1', createdByUserId: 'creator-1' });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'creator-1', assignedBranchId: null, assignedDepartmentRecordId: 'dept-1' }]);
      mockPrisma.dynamicModuleRecord.findMany.mockResolvedValue([{ id: 'dept-1', title: 'ICT Department' }]);

      const result = await service.findOne(TENANT_ID, MODULE_ID, 'rec-1', userWithAll);

      expect(result.creatorContext).toEqual({ branchName: null, departmentName: 'ICT Department', ministryName: null });
    });
  });

  describe('row-level read scoping (§15)', () => {
    it('findAll rejects a caller with neither the static permission nor eligibility-based access', async () => {
      mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([]);

      await expect(service.findAll(TENANT_ID, MODULE_ID, {}, userWithNone)).rejects.toThrow(ForbiddenException);
    });

    it('findAll applies no restriction for a caller with the static module-wide read permission ("superior leader")', async () => {
      mockPrisma.dynamicModuleRecord.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID, MODULE_ID, {}, userWithAll);

      expect(mockEligibilityResolver.resolveResourcesFor).not.toHaveBeenCalled();
      expect(mockPrisma.dynamicModuleRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, moduleDefinitionId: MODULE_ID, deletedAt: null } }),
      );
    });

    it('findAll scopes an eligible-but-not-static-permission caller to their own submissions plus their own branch/department', async () => {
      mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([{ id: 'ra-1', resourceKey: MODULE_ID }]);
      mockEligibilityResolver.resolveScopesFor.mockResolvedValue([
        { scopeEntityType: 'branch', scopeEntityId: 'branch-1' },
        { scopeEntityType: 'dynamic_module_record', scopeEntityId: 'dept-1' },
        { scopeEntityType: 'user_category', scopeEntityId: 'config-item-1' },
      ]);
      mockPrisma.dynamicModuleRecord.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID, MODULE_ID, {}, userWithNone);

      expect(mockPrisma.dynamicModuleRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { createdByUserId: userWithNone.userId },
              { branchId: { in: ['branch-1'] } },
              { attachedToEntityId: { in: ['dept-1'] } },
            ],
          }),
        }),
      );
    });

    it('findOne 404s (not 403s) for an eligible caller viewing a record outside their own scope', async () => {
      mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([{ id: 'ra-1', resourceKey: MODULE_ID }]);
      mockEligibilityResolver.resolveScopesFor.mockResolvedValue([{ scopeEntityType: 'branch', scopeEntityId: 'branch-1' }]);
      mockPrisma.dynamicModuleRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        createdByUserId: 'someone-else',
        branchId: 'branch-2',
        attachedToEntityId: null,
      });

      await expect(service.findOne(TENANT_ID, MODULE_ID, 'rec-1', userWithNone)).rejects.toThrow(NotFoundException);
    });

    it('findOne succeeds for an eligible caller viewing their own submission', async () => {
      mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([{ id: 'ra-1', resourceKey: MODULE_ID }]);
      mockEligibilityResolver.resolveScopesFor.mockResolvedValue([]);
      mockPrisma.dynamicModuleRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        createdByUserId: userWithNone.userId,
        branchId: null,
        attachedToEntityId: null,
      });

      await expect(service.findOne(TENANT_ID, MODULE_ID, 'rec-1', userWithNone)).resolves.toBeDefined();
    });

    it('findOne succeeds for an eligible caller viewing a record under their own branch scope', async () => {
      mockEligibilityResolver.resolveResourcesFor.mockResolvedValue([{ id: 'ra-1', resourceKey: MODULE_ID }]);
      mockEligibilityResolver.resolveScopesFor.mockResolvedValue([{ scopeEntityType: 'branch', scopeEntityId: 'branch-1' }]);
      mockPrisma.dynamicModuleRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        createdByUserId: 'someone-else',
        branchId: 'branch-1',
        attachedToEntityId: null,
      });

      await expect(service.findOne(TENANT_ID, MODULE_ID, 'rec-1', userWithNone)).resolves.toBeDefined();
    });
  });
});
