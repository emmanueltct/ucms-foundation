import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchesService } from '../../branches/branches.service';

/**
 * Organizational visibility roll-up: a user assigned to a Branch should see
 * everything at and beneath it (a Diocese sees every District/Parish/
 * Branch/Cell under it), the same shape `BranchesService.findDescendants`
 * already computes for the deactivate-cascade — this just reuses it for
 * authorization instead. See docs/governance/business-analysis.md.
 */
@Injectable()
export class BranchScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
  ) {}

  /**
   * Returns the set of branch ids a user may see, or `null` meaning
   * "unrestricted" (church-wide staff/admin — the default for every user,
   * since `User.assignedBranchId` is nullable and unset by default, so
   * existing single-branch/flat churches are entirely unaffected by this
   * mechanism existing).
   */
  async resolveVisibleBranchIds(tenantId: string, userId: string): Promise<string[] | null> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId }, select: { assignedBranchId: true } });
    if (!user?.assignedBranchId) return null;

    const descendants = await this.branchesService.findDescendants(tenantId, user.assignedBranchId);
    return [user.assignedBranchId, ...descendants.map((b) => b.id)];
  }
}
