import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Deadline } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDeadlineDto } from './dto/create-deadline.dto';

export type DeadlineEffectiveStatus = 'open' | 'locked' | 'closed';
export type DeadlineWithEffectiveStatus = Deadline & { effectiveStatus: DeadlineEffectiveStatus };

/**
 * A configurable submission deadline against any (entityType, entityId) pair
 * — see docs/governance/business-analysis.md. The stored `status` column is
 * only ever "open" or "closed" at rest; "locked" is a *derived*, read-time
 * state (`effectiveStatus`) computed from `dueAt` vs. now, so nothing needs
 * a scheduled job just to flip a flag. `extend` moves `dueAt` forward
 * (recorded with who/why); `close`/`reopen` are the only ways to change the
 * stored column, mirroring `Visitor.convertToMember`'s "dedicated action per
 * real side effect" shape.
 */
@Injectable()
export class DeadlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, dto: CreateDeadlineDto): Promise<Deadline> {
    return this.prisma.deadline.create({
      data: { tenantId, entityType: dto.entityType, entityId: dto.entityId, dueAt: new Date(dto.dueAt) },
    });
  }

  async findOne(tenantId: string, entityType: string, entityId: string): Promise<DeadlineWithEffectiveStatus> {
    const deadline = await this.findRaw(tenantId, entityType, entityId);
    return { ...deadline, effectiveStatus: this.effectiveStatus(deadline) };
  }

  /** Derives the presented status without ever needing a cron to write "locked" into the column. */
  effectiveStatus(deadline: Deadline): DeadlineEffectiveStatus {
    if (deadline.status === 'closed') return 'closed';
    if (deadline.dueAt.getTime() < Date.now()) return 'locked';
    return 'open';
  }

  /** Throws if the deadline is anything but effectively open — the check every consuming module's edit/submit action should call before writing. */
  async assertOpen(tenantId: string, entityType: string, entityId: string): Promise<void> {
    const deadline = await this.prisma.deadline.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    });
    if (!deadline) return; // no deadline configured for this entity — nothing to enforce
    const status = this.effectiveStatus(deadline);
    if (status !== 'open') {
      throw new BadRequestException({
        code: 'DEADLINE_NOT_OPEN',
        message: status === 'closed' ? 'This has been closed and can no longer be edited.' : 'The deadline has passed — request an extension to continue editing.',
      });
    }
  }

  async extend(
    tenantId: string,
    entityType: string,
    entityId: string,
    userId: string,
    newDueAt: string,
    reason: string,
  ): Promise<Deadline> {
    const deadline = await this.findRaw(tenantId, entityType, entityId);
    if (this.effectiveStatus(deadline) !== 'locked') {
      throw new BadRequestException({ code: 'DEADLINE_NOT_LOCKED', message: 'Only a locked (overdue) deadline can be extended.' });
    }

    const updated = await this.prisma.deadline.update({
      where: { id: deadline.id },
      data: { dueAt: new Date(newDueAt), extendedByUserId: userId, extensionReason: reason },
    });

    await this.audit.record(tenantId, userId, 'deadline.extended', entityType, entityId, {
      reason,
      previousValue: { dueAt: deadline.dueAt },
      newValue: { dueAt: updated.dueAt },
    });

    return updated;
  }

  async close(tenantId: string, entityType: string, entityId: string, userId: string, reason: string): Promise<Deadline> {
    const deadline = await this.findRaw(tenantId, entityType, entityId);
    if (deadline.status === 'closed') {
      throw new BadRequestException({ code: 'DEADLINE_ALREADY_CLOSED', message: 'This deadline is already closed.' });
    }

    const updated = await this.prisma.deadline.update({
      where: { id: deadline.id },
      data: { status: 'closed', closedAt: new Date() },
    });

    await this.audit.record(tenantId, userId, 'deadline.closed', entityType, entityId, {
      reason,
      previousValue: { status: deadline.status },
      newValue: { status: 'closed' },
    });

    return updated;
  }

  /** Reopening a closed deadline requires its own permission — see FR-GOV in docs/governance/functional-requirements.md. */
  async reopen(tenantId: string, entityType: string, entityId: string, userId: string, reason: string): Promise<Deadline> {
    const deadline = await this.findRaw(tenantId, entityType, entityId);
    if (deadline.status !== 'closed') {
      throw new BadRequestException({ code: 'DEADLINE_NOT_CLOSED', message: 'Only a closed deadline can be reopened.' });
    }

    const updated = await this.prisma.deadline.update({
      where: { id: deadline.id },
      data: { status: 'open', closedAt: null },
    });

    await this.audit.record(tenantId, userId, 'deadline.reopened', entityType, entityId, {
      reason,
      previousValue: { status: 'closed' },
      newValue: { status: 'open' },
    });

    return updated;
  }

  private async findRaw(tenantId: string, entityType: string, entityId: string): Promise<Deadline> {
    const deadline = await this.prisma.deadline.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    });
    if (!deadline) throw new NotFoundException({ code: 'DEADLINE_NOT_FOUND', message: 'No deadline exists for this entity.' });
    return deadline;
  }
}
