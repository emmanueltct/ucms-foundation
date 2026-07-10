import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { HierarchyRequirement, HierarchyRequirementSubmission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalWorkflowsService } from '../approval-workflows/approval-workflows.service';
import { DeadlinesService } from '../deadlines/deadlines.service';
import { NotificationsService } from '../communication/notifications.service';
import { CreateHierarchyRequirementDto } from './dto/create-hierarchy-requirement.dto';
import { UpdateHierarchyRequirementDto } from './dto/update-hierarchy-requirement.dto';
import { CreateSubmissionDto, SubmitSubmissionDto } from './dto/create-submission.dto';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

const SUBMISSION_ENTITY_TYPE = 'hierarchy_requirement_submission';

/**
 * A parent organizational level's requirements for its immediate child
 * level — see docs/hierarchy-requirements/business-analysis.md.
 * `parentBranchType`/`childBranchType` reuse Branch's existing `branch_type`
 * ConfigItem keys; deadlines and approval chains for each submission are
 * resolved by key against Phase 0's generic `DeadlinesService`/
 * `ApprovalWorkflowsService` rather than duplicated here.
 */
@Injectable()
export class HierarchyRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvalWorkflows: ApprovalWorkflowsService,
    private readonly deadlines: DeadlinesService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(tenantId: string, dto: CreateHierarchyRequirementDto): Promise<HierarchyRequirement> {
    if (dto.approvalWorkflowId) {
      await this.assertApprovalWorkflowExists(tenantId, dto.approvalWorkflowId);
    }
    return this.prisma.hierarchyRequirement.create({
      data: {
        tenantId,
        parentBranchType: dto.parentBranchType,
        childBranchType: dto.childBranchType,
        kind: dto.kind,
        label: dto.label,
        description: dto.description,
        frequency: dto.frequency,
        dueDayOfPeriod: dto.dueDayOfPeriod,
        approvalWorkflowId: dto.approvalWorkflowId,
        notifyRoleNames: dto.notifyRoleNames ?? [],
      },
    });
  }

  async findAll(
    tenantId: string,
    query: { parentBranchType?: string; childBranchType?: string; kind?: string } = {},
  ): Promise<HierarchyRequirement[]> {
    return this.prisma.hierarchyRequirement.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.parentBranchType ? { parentBranchType: query.parentBranchType } : {}),
        ...(query.childBranchType ? { childBranchType: query.childBranchType } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
      },
      orderBy: { label: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<HierarchyRequirement> {
    const requirement = await this.prisma.hierarchyRequirement.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!requirement) {
      throw new NotFoundException({ code: 'HIERARCHY_REQUIREMENT_NOT_FOUND', message: 'Hierarchy requirement not found.' });
    }
    return requirement;
  }

  async update(tenantId: string, id: string, dto: UpdateHierarchyRequirementDto): Promise<HierarchyRequirement> {
    await this.findOne(tenantId, id);
    if (dto.approvalWorkflowId) {
      await this.assertApprovalWorkflowExists(tenantId, dto.approvalWorkflowId);
    }
    return this.prisma.hierarchyRequirement.update({
      where: { id },
      data: {
        label: dto.label,
        description: dto.description,
        frequency: dto.frequency,
        dueDayOfPeriod: dto.dueDayOfPeriod,
        approvalWorkflowId: dto.approvalWorkflowId,
        notifyRoleNames: dto.notifyRoleNames,
        isActive: dto.isActive,
      },
    });
  }

  async softDelete(tenantId: string, id: string): Promise<HierarchyRequirement> {
    await this.findOne(tenantId, id);
    return this.prisma.hierarchyRequirement.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** "What does my parent require of me" — every active requirement whose childBranchType matches this branch, and whose parentBranchType matches this branch's actual parent. */
  async listForBranch(tenantId: string, branchId: string): Promise<HierarchyRequirement[]> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, deletedAt: null },
      include: { parentBranch: true },
    });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
    if (!branch.branchType || !branch.parentBranch?.branchType) return [];

    return this.prisma.hierarchyRequirement.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        childBranchType: branch.branchType,
        parentBranchType: branch.parentBranch.branchType,
      },
      orderBy: { label: 'asc' },
    });
  }

  /** Opens one submission cycle for a branch against a requirement — idempotent per (requirement, branch, periodLabel), and notifies the configured roles. */
  async createSubmission(
    tenantId: string,
    requirementId: string,
    branchId: string,
    dto: CreateSubmissionDto,
  ): Promise<HierarchyRequirementSubmission> {
    const requirement = await this.findOne(tenantId, requirementId);
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, deletedAt: null },
      include: { parentBranch: true },
    });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
    if (branch.branchType !== requirement.childBranchType || branch.parentBranch?.branchType !== requirement.parentBranchType) {
      throw new BadRequestException({
        code: 'BRANCH_TYPE_MISMATCH',
        message: `This requirement applies to "${requirement.childBranchType}" branches under a "${requirement.parentBranchType}", which this branch does not match.`,
      });
    }

    const existing = await this.prisma.hierarchyRequirementSubmission.findUnique({
      where: {
        tenantId_requirementId_branchId_periodLabel: {
          tenantId,
          requirementId,
          branchId,
          periodLabel: dto.periodLabel ?? '',
        },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'SUBMISSION_ALREADY_EXISTS',
        message: 'A submission for this requirement, branch, and period already exists.',
      });
    }

    const submission = await this.prisma.hierarchyRequirementSubmission.create({
      data: { tenantId, requirementId, branchId, periodLabel: dto.periodLabel, notes: dto.notes },
    });

    if (requirement.approvalWorkflowId) {
      await this.approvalWorkflows.startRequest(tenantId, requirement.approvalWorkflowId, SUBMISSION_ENTITY_TYPE, submission.id);
    }

    await this.notifyRoles(tenantId, requirement, submission);

    return submission;
  }

  async listSubmissionsForRequirement(tenantId: string, requirementId: string): Promise<HierarchyRequirementSubmission[]> {
    await this.findOne(tenantId, requirementId);
    return this.prisma.hierarchyRequirementSubmission.findMany({
      where: { tenantId, requirementId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listSubmissionsForBranch(tenantId: string, branchId: string): Promise<HierarchyRequirementSubmission[]> {
    return this.prisma.hierarchyRequirementSubmission.findMany({
      where: { tenantId, branchId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submit(tenantId: string, submissionId: string, userId: string, dto: SubmitSubmissionDto): Promise<HierarchyRequirementSubmission> {
    const submission = await this.findSubmissionRaw(tenantId, submissionId);
    if (submission.status !== 'pending') {
      throw new BadRequestException({ code: 'SUBMISSION_ALREADY_SUBMITTED', message: 'This submission has already been submitted.' });
    }
    // No-op if no Deadline was ever set for this submission (Phase 0's assertOpen); otherwise blocks a locked/closed cycle.
    await this.deadlines.assertOpen(tenantId, SUBMISSION_ENTITY_TYPE, submissionId);

    return this.prisma.hierarchyRequirementSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'submitted',
        submittedByUserId: userId,
        submittedAt: new Date(),
        attachedDocumentIds: dto.attachedDocumentIds,
        notes: dto.notes,
      },
    });
  }

  async decide(
    tenantId: string,
    submissionId: string,
    decision: 'approved' | 'rejected',
    user: AuthenticatedUser,
    reason: string,
  ): Promise<HierarchyRequirementSubmission> {
    const submission = await this.findSubmissionRaw(tenantId, submissionId);
    if (submission.status !== 'submitted') {
      throw new BadRequestException({
        code: 'SUBMISSION_NOT_SUBMITTED',
        message: 'Only a submitted submission can be approved or rejected.',
      });
    }
    const requirement = await this.findOne(tenantId, submission.requirementId);

    if (requirement.approvalWorkflowId) {
      await this.approvalWorkflows.decide(tenantId, SUBMISSION_ENTITY_TYPE, submission.id, decision, user, reason);
    } else {
      await this.audit.record(tenantId, user.userId, `hierarchy_requirement_submission.${decision}`, SUBMISSION_ENTITY_TYPE, submission.id, {
        reason,
        previousValue: { status: submission.status },
        newValue: { status: decision },
      });
    }

    return this.prisma.hierarchyRequirementSubmission.update({ where: { id: submissionId }, data: { status: decision } });
  }

  private async notifyRoles(tenantId: string, requirement: HierarchyRequirement, submission: HierarchyRequirementSubmission): Promise<void> {
    if (requirement.notifyRoleNames.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: { tenantId, isActive: true, userRoles: { some: { role: { name: { in: requirement.notifyRoleNames } } } } },
      select: { email: true },
    });
    await Promise.all(
      users.map((u) =>
        this.notifications.create(tenantId, undefined, {
          channel: 'email',
          recipient: u.email,
          subject: `New requirement due: ${requirement.label}`,
          body: `A new "${requirement.label}" submission cycle has opened${submission.periodLabel ? ` for ${submission.periodLabel}` : ''}.`,
        }),
      ),
    );
  }

  private async findSubmissionRaw(tenantId: string, id: string): Promise<HierarchyRequirementSubmission> {
    const submission = await this.prisma.hierarchyRequirementSubmission.findFirst({ where: { id, tenantId } });
    if (!submission) throw new NotFoundException({ code: 'SUBMISSION_NOT_FOUND', message: 'Submission not found.' });
    return submission;
  }

  private async assertApprovalWorkflowExists(tenantId: string, approvalWorkflowId: string): Promise<void> {
    await this.approvalWorkflows.findOne(tenantId, approvalWorkflowId); // throws 404 if not found in this tenant
  }
}
