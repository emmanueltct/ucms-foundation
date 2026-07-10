import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { HierarchyRequirementsService } from '../src/hierarchy-requirements/hierarchy-requirements.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { ApprovalWorkflowsService } from '../src/approval-workflows/approval-workflows.service';
import { DeadlinesService } from '../src/deadlines/deadlines.service';
import { NotificationsService } from '../src/communication/notifications.service';

describe('HierarchyRequirementsService', () => {
  let service: HierarchyRequirementsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    hierarchyRequirement: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    hierarchyRequirementSubmission: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    branch: { findFirst: jest.fn() },
    user: { findMany: jest.fn() },
  };

  const mockAuditService = { record: jest.fn() };
  const mockApprovalWorkflows = { findOne: jest.fn(), startRequest: jest.fn(), decide: jest.fn() };
  const mockDeadlines = { assertOpen: jest.fn() };
  const mockNotifications = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDeadlines.assertOpen.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        HierarchyRequirementsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: ApprovalWorkflowsService, useValue: mockApprovalWorkflows },
        { provide: DeadlinesService, useValue: mockDeadlines },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = moduleRef.get(HierarchyRequirementsService);
  });

  describe('create', () => {
    it('creates a requirement without an approval workflow', async () => {
      mockPrisma.hierarchyRequirement.create.mockResolvedValue({ id: 'req-1' });
      const result = await service.create(TENANT_ID, {
        parentBranchType: 'diocese',
        childBranchType: 'district',
        kind: 'report',
        label: 'Monthly activity report',
      } as any);
      expect(result).toEqual({ id: 'req-1' });
      expect(mockApprovalWorkflows.findOne).not.toHaveBeenCalled();
    });

    it('validates the approval workflow belongs to this tenant when given', async () => {
      mockApprovalWorkflows.findOne.mockResolvedValue({ id: 'wf-1' });
      mockPrisma.hierarchyRequirement.create.mockResolvedValue({ id: 'req-1' });
      await service.create(TENANT_ID, {
        parentBranchType: 'diocese',
        childBranchType: 'district',
        kind: 'report',
        label: 'Monthly activity report',
        approvalWorkflowId: 'wf-1',
      } as any);
      expect(mockApprovalWorkflows.findOne).toHaveBeenCalledWith(TENANT_ID, 'wf-1');
    });
  });

  describe('listForBranch', () => {
    it('throws when the branch does not exist', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      await expect(service.listForBranch(TENANT_ID, 'branch-1')).rejects.toThrow(NotFoundException);
    });

    it('returns [] when the branch or its parent has no branchType configured', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', branchType: null, parentBranch: null });
      const result = await service.listForBranch(TENANT_ID, 'branch-1');
      expect(result).toEqual([]);
    });

    it('finds requirements matching the branch and its actual parent type', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({
        id: 'branch-1',
        branchType: 'district',
        parentBranch: { branchType: 'diocese' },
      });
      mockPrisma.hierarchyRequirement.findMany.mockResolvedValue([{ id: 'req-1' }]);
      const result = await service.listForBranch(TENANT_ID, 'branch-1');
      expect(mockPrisma.hierarchyRequirement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ childBranchType: 'district', parentBranchType: 'diocese' }),
        }),
      );
      expect(result).toEqual([{ id: 'req-1' }]);
    });
  });

  describe('createSubmission', () => {
    const requirement = { id: 'req-1', childBranchType: 'district', parentBranchType: 'diocese', approvalWorkflowId: null, notifyRoleNames: [] };

    beforeEach(() => {
      mockPrisma.hierarchyRequirement.findFirst.mockResolvedValue(requirement);
    });

    it('rejects when the branch does not exist', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      await expect(service.createSubmission(TENANT_ID, 'req-1', 'branch-1', {})).rejects.toThrow(NotFoundException);
    });

    it("rejects when the branch's type/parent-type don't match the requirement", async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', branchType: 'parish', parentBranch: { branchType: 'diocese' } });
      await expect(service.createSubmission(TENANT_ID, 'req-1', 'branch-1', {})).rejects.toThrow(BadRequestException);
    });

    it('rejects a duplicate submission for the same requirement/branch/period', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', branchType: 'district', parentBranch: { branchType: 'diocese' } });
      mockPrisma.hierarchyRequirementSubmission.findUnique.mockResolvedValue({ id: 'sub-existing' });
      await expect(service.createSubmission(TENANT_ID, 'req-1', 'branch-1', {})).rejects.toThrow(ConflictException);
    });

    it('creates a submission, starts an approval request, and notifies configured roles', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', branchType: 'district', parentBranch: { branchType: 'diocese' } });
      mockPrisma.hierarchyRequirementSubmission.findUnique.mockResolvedValue(null);
      mockPrisma.hierarchyRequirementSubmission.create.mockResolvedValue({ id: 'sub-1', periodLabel: '2026-07' });
      mockPrisma.hierarchyRequirement.findFirst.mockResolvedValue({ ...requirement, approvalWorkflowId: 'wf-1', notifyRoleNames: ['Bishop'] });
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'bishop@example.com' }]);

      const result = await service.createSubmission(TENANT_ID, 'req-1', 'branch-1', { periodLabel: '2026-07' });

      expect(result).toEqual({ id: 'sub-1', periodLabel: '2026-07' });
      expect(mockApprovalWorkflows.startRequest).toHaveBeenCalledWith(TENANT_ID, 'wf-1', 'hierarchy_requirement_submission', 'sub-1');
      expect(mockNotifications.create).toHaveBeenCalledWith(
        TENANT_ID,
        undefined,
        expect.objectContaining({ channel: 'email', recipient: 'bishop@example.com' }),
      );
    });
  });

  describe('submit', () => {
    it('rejects when the submission is not pending', async () => {
      mockPrisma.hierarchyRequirementSubmission.findFirst.mockResolvedValue({ id: 'sub-1', status: 'submitted' });
      await expect(service.submit(TENANT_ID, 'sub-1', 'user-1', {})).rejects.toThrow(BadRequestException);
    });

    it('marks a pending submission as submitted', async () => {
      mockPrisma.hierarchyRequirementSubmission.findFirst.mockResolvedValue({ id: 'sub-1', status: 'pending' });
      mockPrisma.hierarchyRequirementSubmission.update.mockResolvedValue({ id: 'sub-1', status: 'submitted' });
      const result = await service.submit(TENANT_ID, 'sub-1', 'user-1', { notes: 'Attached the report.' });
      expect(result).toEqual({ id: 'sub-1', status: 'submitted' });
      expect(mockDeadlines.assertOpen).toHaveBeenCalledWith(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1');
      expect(mockPrisma.hierarchyRequirementSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sub-1' }, data: expect.objectContaining({ status: 'submitted', submittedByUserId: 'user-1' }) }),
      );
    });

    it('rejects when the deadline is locked or closed', async () => {
      mockPrisma.hierarchyRequirementSubmission.findFirst.mockResolvedValue({ id: 'sub-1', status: 'pending' });
      mockDeadlines.assertOpen.mockRejectedValue(new BadRequestException({ code: 'DEADLINE_NOT_OPEN', message: 'locked' }));
      await expect(service.submit(TENANT_ID, 'sub-1', 'user-1', {})).rejects.toThrow(BadRequestException);
      expect(mockPrisma.hierarchyRequirementSubmission.update).not.toHaveBeenCalled();
    });
  });

  describe('decide', () => {
    const user = { userId: 'user-1', tenantId: TENANT_ID, email: 'a@b.com', isPlatformAdmin: false, permissions: [], roles: [] };

    it('rejects when the submission was not submitted', async () => {
      mockPrisma.hierarchyRequirementSubmission.findFirst.mockResolvedValue({ id: 'sub-1', status: 'pending' });
      await expect(service.decide(TENANT_ID, 'sub-1', 'approved', user, 'Looks good.')).rejects.toThrow(BadRequestException);
    });

    it('delegates to ApprovalWorkflowsService when a workflow is configured', async () => {
      mockPrisma.hierarchyRequirementSubmission.findFirst.mockResolvedValue({ id: 'sub-1', status: 'submitted', requirementId: 'req-1' });
      mockPrisma.hierarchyRequirement.findFirst.mockResolvedValue({ id: 'req-1', approvalWorkflowId: 'wf-1' });
      mockPrisma.hierarchyRequirementSubmission.update.mockResolvedValue({ id: 'sub-1', status: 'approved' });

      await service.decide(TENANT_ID, 'sub-1', 'approved', user, 'Looks good.');

      expect(mockApprovalWorkflows.decide).toHaveBeenCalledWith(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1', 'approved', user, 'Looks good.');
      expect(mockAuditService.record).not.toHaveBeenCalled();
    });

    it('records directly via AuditService when no workflow is configured', async () => {
      mockPrisma.hierarchyRequirementSubmission.findFirst.mockResolvedValue({ id: 'sub-1', status: 'submitted', requirementId: 'req-1' });
      mockPrisma.hierarchyRequirement.findFirst.mockResolvedValue({ id: 'req-1', approvalWorkflowId: null });
      mockPrisma.hierarchyRequirementSubmission.update.mockResolvedValue({ id: 'sub-1', status: 'rejected' });

      await service.decide(TENANT_ID, 'sub-1', 'rejected', user, 'Missing signatures.');

      expect(mockApprovalWorkflows.decide).not.toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        TENANT_ID,
        'user-1',
        'hierarchy_requirement_submission.rejected',
        'hierarchy_requirement_submission',
        'sub-1',
        expect.objectContaining({ reason: 'Missing signatures.' }),
      );
    });
  });
});
