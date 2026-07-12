import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Generalized leadership-based access (§11) — a user may be appointed as
 * leader of ANY organizational unit or custom entity (Branch, Ministry,
 * Committee, a custom Dynamic Module record, ...), not just Departments/
 * Branches via the two existing hardcoded `User` scope fields. Additive
 * alongside `BranchScopeService`/`DepartmentScopeService` — this is the
 * mechanism for everything else those two don't cover, not a replacement.
 */
@Injectable()
export class LeadershipScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Whether `userId` holds a leadership appointment over this specific target entity — the row-level check that turns "an admin appointed someone" into scoped access. */
  async isLeaderOf(tenantId: string, userId: string, targetEntityType: string, targetEntityId: string): Promise<boolean> {
    const appointment = await this.prisma.leadershipAppointment.findFirst({
      where: { tenantId, userId, targetEntityType, targetEntityId },
    });
    return !!appointment;
  }

  /** Every appointment this user currently holds — powers "which branches/entities do I administer" UI (e.g. a Branch Administrator's user-registration form). */
  async resolveAppointmentsFor(tenantId: string, userId: string) {
    return this.prisma.leadershipAppointment.findMany({ where: { tenantId, userId } });
  }

  /** Every appointment held over one specific target — powers a target's "Assigned Administrator(s)" panel. */
  async resolveLeadersOf(tenantId: string, targetEntityType: string, targetEntityId: string) {
    return this.prisma.leadershipAppointment.findMany({
      where: { tenantId, targetEntityType, targetEntityId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }
}
