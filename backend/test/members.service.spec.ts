import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MembersService } from '../src/members/members.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/families/families.service';
import { CustomFieldsService } from '../src/custom-fields/custom-fields.service';
import { AuditService } from '../src/audit/audit.service';
import { ApprovalWorkflowsService } from '../src/approval-workflows/approval-workflows.service';

describe('MembersService', () => {
  let service: MembersService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    member: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      findFirst: jest.fn(),
    },
    approvalWorkflow: {
      findFirst: jest.fn(),
    },
  };

  const mockFamilies = {
    findOne: jest.fn(),
    clearHeadIfMember: jest.fn(),
  };

  const mockCustomFields = {
    assertRequiredFieldsProvided: jest.fn().mockResolvedValue(undefined),
    setValues: jest.fn().mockResolvedValue(undefined),
    getValues: jest.fn().mockResolvedValue({}),
    getValuesForMany: jest.fn().mockResolvedValue({}),
  };

  const mockAudit = { record: jest.fn() };
  const mockApprovalWorkflows = { startRequest: jest.fn(), decide: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCustomFields.assertRequiredFieldsProvided.mockResolvedValue(undefined);
    mockCustomFields.setValues.mockResolvedValue(undefined);
    mockCustomFields.getValues.mockResolvedValue({});
    mockCustomFields.getValuesForMany.mockResolvedValue({});
    mockPrisma.approvalWorkflow.findFirst.mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FamiliesService, useValue: mockFamilies },
        { provide: CustomFieldsService, useValue: mockCustomFields },
        { provide: AuditService, useValue: mockAudit },
        { provide: ApprovalWorkflowsService, useValue: mockApprovalWorkflows },
      ],
    }).compile();
    service = moduleRef.get(MembersService);
  });

  describe('create', () => {
    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, { branchId: 'missing', firstName: 'Jean', lastName: 'Uwimana' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when familyId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockFamilies.findOne.mockRejectedValue(new NotFoundException({ code: 'FAMILY_NOT_FOUND' }));

      await expect(
        service.create(TENANT_ID, {
          branchId: 'branch-1',
          familyId: 'missing-family',
          firstName: 'Jean',
          lastName: 'Uwimana',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate membershipNumber within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'existing-member' });

      await expect(
        service.create(TENANT_ID, {
          branchId: 'branch-1',
          membershipNumber: 'MBR-0001',
          firstName: 'Jean',
          lastName: 'Uwimana',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a member when branch/family/membershipNumber all check out', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.member.findFirst.mockResolvedValue(null);
      mockPrisma.member.create.mockResolvedValue({ id: 'mem-1' });

      await service.create(TENANT_ID, {
        branchId: 'branch-1',
        membershipNumber: 'MBR-0001',
        firstName: 'Jean',
        lastName: 'Uwimana',
      });

      expect(mockPrisma.member.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: TENANT_ID, branchId: 'branch-1', membershipStatus: 'active' }),
        }),
      );
    });

    it('checks required custom fields before writing the member row, and persists+returns any provided', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.member.findFirst.mockResolvedValue(null);
      mockPrisma.member.create.mockResolvedValue({ id: 'mem-1' });

      const result = await service.create(TENANT_ID, {
        branchId: 'branch-1',
        firstName: 'Jean',
        lastName: 'Uwimana',
        customFields: { confirmation_date: '2020-06-01' },
      });

      expect(mockCustomFields.assertRequiredFieldsProvided).toHaveBeenCalledWith(TENANT_ID, 'member', {
        confirmation_date: '2020-06-01',
      });
      expect(mockCustomFields.setValues).toHaveBeenCalledWith(TENANT_ID, 'member', 'mem-1', {
        confirmation_date: '2020-06-01',
      });
      expect(result.customFields).toEqual({ confirmation_date: '2020-06-01' });
    });

    it('propagates a missing-required-custom-field rejection before creating the member row', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockCustomFields.assertRequiredFieldsProvided.mockRejectedValue(
        new Error('CUSTOM_FIELD_REQUIRED'),
      );

      await expect(
        service.create(TENANT_ID, { branchId: 'branch-1', firstName: 'Jean', lastName: 'Uwimana' }),
      ).rejects.toThrow('CUSTOM_FIELD_REQUIRED');

      expect(mockPrisma.member.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('clears the family head reference when familyId changes away from the current family', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID, familyId: 'fam-old' });
      mockFamilies.findOne.mockResolvedValue({ id: 'fam-new' });
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1', familyId: 'fam-new' });

      await service.update(TENANT_ID, 'mem-1', { familyId: 'fam-new' });

      expect(mockFamilies.clearHeadIfMember).toHaveBeenCalledWith(TENANT_ID, 'mem-1');
    });

    it('does not touch the family head reference when familyId is unchanged', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID, familyId: 'fam-1' });
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1' });

      await service.update(TENANT_ID, 'mem-1', { firstName: 'Jean-Pierre' });

      expect(mockFamilies.clearHeadIfMember).not.toHaveBeenCalled();
    });

    it('persists provided custom field values and returns the merged current state', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID, familyId: null });
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1' });
      mockCustomFields.getValues.mockResolvedValue({ confirmation_date: '2020-06-01', spiritual_gift: 'teaching' });

      const result = await service.update(TENANT_ID, 'mem-1', { customFields: { spiritual_gift: 'teaching' } });

      expect(mockCustomFields.setValues).toHaveBeenCalledWith(TENANT_ID, 'member', 'mem-1', { spiritual_gift: 'teaching' });
      expect(result.customFields).toEqual({ confirmation_date: '2020-06-01', spiritual_gift: 'teaching' });
    });
  });

  describe('findAll', () => {
    it('batch-attaches custom field values to every returned member', async () => {
      mockPrisma.member.findMany.mockResolvedValue([{ id: 'mem-1' }, { id: 'mem-2' }]);
      mockPrisma.member.count.mockResolvedValue(2);
      mockCustomFields.getValuesForMany.mockResolvedValue({ 'mem-1': { confirmation_date: '2020-06-01' } });

      const result = await service.findAll(TENANT_ID, { page: 1, pageSize: 20 } as any);

      expect(mockCustomFields.getValuesForMany).toHaveBeenCalledWith(TENANT_ID, 'member', ['mem-1', 'mem-2']);
      expect(result.items[0].customFields).toEqual({ confirmation_date: '2020-06-01' });
      expect(result.items[1].customFields).toEqual({});
    });

    it('scopes to the visible branch set when the caller is branch-restricted', async () => {
      mockPrisma.member.findMany.mockResolvedValue([]);
      mockPrisma.member.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { page: 1, pageSize: 20 } as any, ['branch-1', 'branch-2']);

      expect(mockPrisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ branchId: { in: ['branch-1', 'branch-2'] } }) }),
      );
    });

    it('is unrestricted when visibleBranchIds is null (the default)', async () => {
      mockPrisma.member.findMany.mockResolvedValue([]);
      mockPrisma.member.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { page: 1, pageSize: 20 } as any);

      expect(mockPrisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.not.objectContaining({ branchId: expect.anything() }) }),
      );
    });
  });

  describe('transfer', () => {
    it('rejects when the target branch does not resolve within the tenant', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID });
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.transfer(TENANT_ID, 'mem-1', 'missing-branch')).rejects.toThrow(NotFoundException);
    });

    it('moves the member to the new branch', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID });
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-2' });
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1', branchId: 'branch-2' });

      await service.transfer(TENANT_ID, 'mem-1', 'branch-2');

      expect(mockPrisma.member.update).toHaveBeenCalledWith({ where: { id: 'mem-1' }, data: { branchId: 'branch-2' } });
    });
  });

  describe('softDelete', () => {
    it('soft-deletes the member and clears any family head reference pointing at them', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', tenantId: TENANT_ID });
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1', isActive: false });

      await service.softDelete(TENANT_ID, 'mem-1');

      expect(mockFamilies.clearHeadIfMember).toHaveBeenCalledWith(TENANT_ID, 'mem-1');
      expect(mockPrisma.member.update).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });
  });

  describe('findAllForExport', () => {
    it('applies the same filters as findAll but with no pagination, capped at 5000 rows', async () => {
      mockPrisma.member.findMany.mockResolvedValue([{ id: 'mem-1' }, { id: 'mem-2' }]);

      const result = await service.findAllForExport(TENANT_ID, { branchId: 'branch-1' } as any);

      expect(mockPrisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, branchId: 'branch-1' }),
          take: 5000,
        }),
      );
      expect(mockPrisma.member.findMany.mock.calls[0][0]).not.toHaveProperty('skip');
      expect(result).toHaveLength(2);
    });
  });

  describe('registerPublic', () => {
    it('rejects when the branch does not exist', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      await expect(
        service.registerPublic(TENANT_ID, { branchId: 'missing', firstName: 'Jean', lastName: 'Uwimana' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('always creates the member with membershipStatus "pending"', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.member.create.mockResolvedValue({ id: 'mem-1', membershipStatus: 'pending' });

      await service.registerPublic(TENANT_ID, { branchId: 'branch-1', firstName: 'Jean', lastName: 'Uwimana' } as any);

      expect(mockPrisma.member.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ membershipStatus: 'pending' }) }),
      );
    });
  });

  const user = { userId: 'user-1', tenantId: TENANT_ID, email: 'a@b.com', isPlatformAdmin: false, permissions: [], roles: [] };

  describe('approve/reject', () => {
    it('rejects when the member is not pending', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', membershipStatus: 'active' });
      await expect(service.approve(TENANT_ID, 'mem-1', user, 'Looks good.')).rejects.toThrow(BadRequestException);
    });

    it('records directly via AuditService when no workflow is configured for member_registration', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', membershipStatus: 'pending' });
      mockPrisma.approvalWorkflow.findFirst.mockResolvedValue(null);
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1', membershipStatus: 'active' });

      await service.approve(TENANT_ID, 'mem-1', user, 'Documents verified in person.');

      expect(mockApprovalWorkflows.decide).not.toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        TENANT_ID,
        'user-1',
        'member.registration.approved',
        'member_registration',
        'mem-1',
        expect.objectContaining({ reason: 'Documents verified in person.' }),
      );
      expect(mockPrisma.member.update).toHaveBeenCalledWith({ where: { id: 'mem-1' }, data: { membershipStatus: 'active' } });
    });

    it('routes through a configured ApprovalWorkflow for member_registration', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'mem-1', membershipStatus: 'pending' });
      mockPrisma.approvalWorkflow.findFirst.mockResolvedValue({ id: 'wf-1' });
      mockPrisma.member.update.mockResolvedValue({ id: 'mem-1', membershipStatus: 'rejected' });

      await service.reject(TENANT_ID, 'mem-1', user, 'Could not verify identity.');

      expect(mockApprovalWorkflows.startRequest).toHaveBeenCalledWith(TENANT_ID, 'wf-1', 'member_registration', 'mem-1');
      expect(mockApprovalWorkflows.decide).toHaveBeenCalledWith(TENANT_ID, 'member_registration', 'mem-1', 'rejected', user, 'Could not verify identity.');
      expect(mockAudit.record).not.toHaveBeenCalled();
      expect(mockPrisma.member.update).toHaveBeenCalledWith({ where: { id: 'mem-1' }, data: { membershipStatus: 'rejected' } });
    });
  });
});
