import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DynamicModuleRecordsService } from '../src/dynamic-modules/dynamic-module-records.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { ApprovalWorkflowsService } from '../src/approval-workflows/approval-workflows.service';
import { CustomFieldsService } from '../src/custom-fields/custom-fields.service';
import { DynamicModuleDefinitionsService } from '../src/dynamic-modules/dynamic-module-definitions.service';

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
  };

  const mockAudit = { record: jest.fn() };
  const mockApprovalWorkflows = { startRequest: jest.fn(), decide: jest.fn() };
  const mockCustomFields = { assertRequiredFieldsProvided: jest.fn(), setValues: jest.fn(), getValues: jest.fn().mockResolvedValue({}), getValuesForMany: jest.fn().mockResolvedValue({}) };
  const mockDefinitions = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCustomFields.getValues.mockResolvedValue({});
    mockCustomFields.getValuesForMany.mockResolvedValue({});
    const moduleRef = await Test.createTestingModule({
      providers: [
        DynamicModuleRecordsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: ApprovalWorkflowsService, useValue: mockApprovalWorkflows },
        { provide: CustomFieldsService, useValue: mockCustomFields },
        { provide: DynamicModuleDefinitionsService, useValue: mockDefinitions },
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
});
