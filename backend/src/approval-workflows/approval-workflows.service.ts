import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalRequest, ApprovalWorkflow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';

export type ApprovalWorkflowWithSteps = ApprovalWorkflow & {
  steps: { id: string; stepOrder: number; label: string; approverRoleName: string | null; approverPermissionCode: string | null }[];
};

/**
 * A tenant-defined, ordered approval chain reused by member-registration
 * approval, Dynamic Module record status transitions, and hierarchy
 * requirement submissions — one generic engine, not three bespoke ones. See
 * docs/governance/business-analysis.md. Deliberately a linear chain (no
 * conditional branching) — see design decision in that doc.
 */
@Injectable()
export class ApprovalWorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, dto: CreateApprovalWorkflowDto): Promise<ApprovalWorkflowWithSteps> {
    return this.prisma.approvalWorkflow.create({
      data: {
        tenantId,
        entityType: dto.entityType,
        name: dto.name,
        steps: {
          create: dto.steps.map((step, i) => ({
            tenantId,
            stepOrder: i + 1,
            label: step.label,
            approverRoleName: step.approverRoleName,
            approverPermissionCode: step.approverPermissionCode,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async findAll(tenantId: string, entityType?: string): Promise<ApprovalWorkflowWithSteps[]> {
    return this.prisma.approvalWorkflow.findMany({
      where: { tenantId, ...(entityType ? { entityType } : {}) },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<ApprovalWorkflowWithSteps> {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { id, tenantId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!workflow) {
      throw new NotFoundException({ code: 'APPROVAL_WORKFLOW_NOT_FOUND', message: 'Approval workflow not found.' });
    }
    return workflow;
  }

  async update(tenantId: string, id: string, dto: UpdateApprovalWorkflowDto): Promise<ApprovalWorkflow> {
    await this.findOne(tenantId, id);
    return this.prisma.approvalWorkflow.update({ where: { id }, data: { name: dto.name, isActive: dto.isActive } });
  }

  /** The "recreate" half of "delete and recreate the workflow to change its step chain" (steps are otherwise immutable). Blocked once any ApprovalRequest exists against it — that history must stay attributable to a real workflow. */
  async remove(tenantId: string, id: string): Promise<{ id: string }> {
    await this.findOne(tenantId, id);
    const requestCount = await this.prisma.approvalRequest.count({ where: { tenantId, workflowId: id } });
    if (requestCount > 0) {
      throw new ConflictException({
        code: 'APPROVAL_WORKFLOW_IN_USE',
        message: 'This workflow has approval history and cannot be deleted — deactivate it instead.',
      });
    }
    await this.prisma.approvalWorkflow.delete({ where: { id } });
    return { id };
  }

  /** Starts (or returns the already-existing) approval request for one concrete entity — idempotent, never creates a duplicate for the same (entityType, entityId). */
  async startRequest(tenantId: string, workflowId: string, entityType: string, entityId: string): Promise<ApprovalRequest> {
    const existing = await this.prisma.approvalRequest.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    });
    if (existing) return existing;

    await this.findOne(tenantId, workflowId); // 404s if the workflow doesn't belong to this tenant
    return this.prisma.approvalRequest.create({ data: { tenantId, workflowId, entityType, entityId } });
  }

  async getRequest(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.approvalRequest.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
      include: { workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } } },
    });
  }

  /**
   * Records one decision on the request's *current* step, advancing to the
   * next step on approval or closing the whole request on rejection.
   * Callers should mark their route `@RequiresAuditReason()` — `reason` is
   * always written to `AuditLog` here regardless.
   */
  async decide(
    tenantId: string,
    entityType: string,
    entityId: string,
    decision: 'approved' | 'rejected',
    user: AuthenticatedUser,
    reason: string,
  ): Promise<ApprovalRequest> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
      include: { workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } } },
    });
    if (!request) {
      throw new NotFoundException({ code: 'APPROVAL_REQUEST_NOT_FOUND', message: 'No approval request exists for this entity.' });
    }
    if (request.status !== 'pending') {
      throw new BadRequestException({
        code: 'APPROVAL_REQUEST_ALREADY_DECIDED',
        message: `This request was already ${request.status}.`,
      });
    }

    const currentStep = request.workflow.steps.find((s) => s.stepOrder === request.currentStepOrder);
    if (currentStep && !this.canActOnStep(currentStep, user)) {
      throw new ForbiddenException({
        code: 'APPROVAL_STEP_FORBIDDEN',
        message: `You are not the approver for step "${currentStep.label}".`,
      });
    }

    const isLastStep = !request.workflow.steps.some((s) => s.stepOrder > request.currentStepOrder);
    const nextStatus = decision === 'rejected' ? 'rejected' : isLastStep ? 'approved' : 'pending';
    const nextStepOrder = decision === 'approved' && !isLastStep ? request.currentStepOrder + 1 : request.currentStepOrder;

    const updated = await this.prisma.approvalRequest.update({
      where: { id: request.id },
      data: { status: nextStatus, currentStepOrder: nextStepOrder },
    });

    await this.audit.record(tenantId, user.userId, `approval.${decision}`, 'approval_request', request.id, {
      reason,
      previousValue: { status: request.status, currentStepOrder: request.currentStepOrder },
      newValue: { status: nextStatus, currentStepOrder: nextStepOrder },
    });

    return updated;
  }

  private canActOnStep(
    step: { approverRoleName: string | null; approverPermissionCode: string | null },
    user: AuthenticatedUser,
  ): boolean {
    if (user.isPlatformAdmin) return true;
    if (step.approverRoleName) return user.roles.includes(step.approverRoleName);
    if (step.approverPermissionCode) return user.permissions.includes(step.approverPermissionCode);
    return true; // a step with no gate configured is open to anyone who reached this far
  }
}
