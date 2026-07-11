import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

export interface AuditContext {
  /** Mandatory-comment text for actions gated by `@RequiresAuditReason()` — becomes part of the permanent audit history. */
  reason?: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generalizes what used to be `AuthService`'s private `audit()` helper
 * (login/logout/MFA only) into shared, injectable infrastructure any module
 * can call. `AuditLog` is the one, permanent record of "who changed what,
 * when, and why" across the whole platform — see
 * docs/governance/business-analysis.md.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    tenantId: string,
    userId: string | undefined,
    action: string,
    entityType: string,
    entityId: string | undefined,
    context: AuditContext = {},
  ): Promise<void> {
    const metadata = { ...(context.userAgent ? { userAgent: context.userAgent } : {}), ...context.metadata };
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        entityType,
        entityId,
        reason: context.reason,
        previousValue: context.previousValue as Prisma.InputJsonValue | undefined,
        newValue: context.newValue as Prisma.InputJsonValue | undefined,
        ipAddress: context.ipAddress,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    });
  }

  /** Read-only viewer for the Configuration Center's Audit Log tab — the write side (`record`) is used everywhere else. */
  async findAll(tenantId: string, query: AuditLogQueryDto) {
    const where = {
      tenantId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }
}
