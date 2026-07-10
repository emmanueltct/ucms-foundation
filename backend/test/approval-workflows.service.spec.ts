import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApprovalWorkflowsService } from '../src/approval-workflows/approval-workflows.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { AuthenticatedUser } from '../src/common/interfaces/request-context.interface';

describe('ApprovalWorkflowsService', () => {
  let service: ApprovalWorkflowsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    approvalWorkflow: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    approvalRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };

  const mockAuditService = { record: jest.fn() };

  const user = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
    userId: 'user-1',
    tenantId: TENANT_ID,
    email: 'u@test.com',
    isPlatformAdmin: false,
    roles: [],
    permissions: [],
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ApprovalWorkflowsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();
    service = moduleRef.get(ApprovalWorkflowsService);
  });

  describe('create', () => {
    it('creates a workflow with ordered steps derived from array position', async () => {
      mockPrisma.approvalWorkflow.create.mockResolvedValue({ id: 'wf-1' });

      await service.create(TENANT_ID, {
        entityType: 'member_registration',
        name: 'Standard approval',
        steps: [{ label: 'Branch leader' }, { label: 'District coordinator', approverRoleName: 'district_coordinator' }],
      } as any);

      expect(mockPrisma.approvalWorkflow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            steps: {
              create: [
                expect.objectContaining({ stepOrder: 1, label: 'Branch leader' }),
                expect.objectContaining({ stepOrder: 2, label: 'District coordinator', approverRoleName: 'district_coordinator' }),
              ],
            },
          }),
        }),
      );
    });
  });

  describe('startRequest', () => {
    it('is idempotent — returns the existing request rather than creating a duplicate', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue({ id: 'req-1' });

      const result = await service.startRequest(TENANT_ID, 'wf-1', 'member_registration', 'member-1');

      expect(result).toEqual({ id: 'req-1' });
      expect(mockPrisma.approvalRequest.create).not.toHaveBeenCalled();
    });

    it('rejects when the workflow does not belong to this tenant', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue(null);
      mockPrisma.approvalWorkflow.findFirst.mockResolvedValue(null);

      await expect(service.startRequest(TENANT_ID, 'wf-1', 'member_registration', 'member-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a new request at step 1 when none exists', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue(null);
      mockPrisma.approvalWorkflow.findFirst.mockResolvedValue({ id: 'wf-1', steps: [] });
      mockPrisma.approvalRequest.create.mockResolvedValue({ id: 'req-1' });

      await service.startRequest(TENANT_ID, 'wf-1', 'member_registration', 'member-1');

      expect(mockPrisma.approvalRequest.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT_ID, workflowId: 'wf-1', entityType: 'member_registration', entityId: 'member-1' },
      });
    });
  });

  describe('decide', () => {
    const twoStepWorkflow = {
      id: 'wf-1',
      steps: [
        { stepOrder: 1, label: 'Branch leader', approverRoleName: 'branch_leader', approverPermissionCode: null },
        { stepOrder: 2, label: 'District coordinator', approverRoleName: 'district_coordinator', approverPermissionCode: null },
      ],
    };

    it('rejects when no request exists', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.decide(TENANT_ID, 'member_registration', 'member-1', 'approved', user(), 'Looks good.'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a decision on an already-decided request', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'approved',
        currentStepOrder: 2,
        workflow: twoStepWorkflow,
      });

      await expect(
        service.decide(TENANT_ID, 'member_registration', 'member-1', 'approved', user(), 'Looks good.'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the caller does not hold the current step\'s approver role', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        currentStepOrder: 1,
        workflow: twoStepWorkflow,
      });

      await expect(
        service.decide(TENANT_ID, 'member_registration', 'member-1', 'approved', user({ roles: ['member'] }), 'Looks good.'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('platform admins can act on any step regardless of role', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        currentStepOrder: 1,
        workflow: twoStepWorkflow,
      });
      mockPrisma.approvalRequest.update.mockResolvedValue({ id: 'req-1', status: 'pending', currentStepOrder: 2 });

      await service.decide(TENANT_ID, 'member_registration', 'member-1', 'approved', user({ isPlatformAdmin: true }), 'ok');

      expect(mockPrisma.approvalRequest.update).toHaveBeenCalled();
    });

    it('advances to the next step on approval when more steps remain', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        currentStepOrder: 1,
        workflow: twoStepWorkflow,
      });
      mockPrisma.approvalRequest.update.mockResolvedValue({ id: 'req-1', status: 'pending', currentStepOrder: 2 });

      await service.decide(TENANT_ID, 'member_registration', 'member-1', 'approved', user({ roles: ['branch_leader'] }), 'Looks good.');

      expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'pending', currentStepOrder: 2 },
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        TENANT_ID,
        'user-1',
        'approval.approved',
        'approval_request',
        'req-1',
        expect.objectContaining({ reason: 'Looks good.' }),
      );
    });

    it('marks the whole request approved once the final step approves', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        currentStepOrder: 2,
        workflow: twoStepWorkflow,
      });
      mockPrisma.approvalRequest.update.mockResolvedValue({ id: 'req-1', status: 'approved', currentStepOrder: 2 });

      await service.decide(TENANT_ID, 'member_registration', 'member-1', 'approved', user({ roles: ['district_coordinator'] }), 'Final ok.');

      expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'approved', currentStepOrder: 2 },
      });
    });

    it('rejecting closes the request immediately regardless of step position', async () => {
      mockPrisma.approvalRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        currentStepOrder: 1,
        workflow: twoStepWorkflow,
      });
      mockPrisma.approvalRequest.update.mockResolvedValue({ id: 'req-1', status: 'rejected', currentStepOrder: 1 });

      await service.decide(TENANT_ID, 'member_registration', 'member-1', 'rejected', user({ roles: ['branch_leader'] }), 'Missing documents.');

      expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'rejected', currentStepOrder: 1 },
      });
    });
  });
});
