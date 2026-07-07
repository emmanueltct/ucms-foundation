import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchesService } from '../branches/branches.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

/**
 * The current tenant's own view of itself, as opposed to TenantsService
 * (Platform Admin's cross-tenant management). Backs the onboarding wizard's
 * final step once branding + hierarchy have been set up via the branches
 * module.
 */
@Injectable()
export class TenantProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
  ) {}

  async getProfile(tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Church not found.' });
    return tenant;
  }

  /**
   * Idempotent final onboarding step: ensures at least one headquarters
   * branch exists (creating one if the wizard's hierarchy step was skipped),
   * then marks the tenant onboarded. Safe to call more than once.
   */
  async completeOnboarding(tenantId: string, dto: CompleteOnboardingDto) {
    const tenant = await this.getProfile(tenantId);

    const existingBranches = await this.branchesService.findAll(tenantId, true);
    if (existingBranches.length === 0) {
      await this.branchesService.create(tenantId, {
        name: dto.headquartersName ?? tenant.name,
        branchType: dto.headquartersType ?? 'headquarters',
        isHeadquarters: true,
      });
    }

    if (tenant.onboardedAt) return tenant;
    return this.prisma.tenant.update({ where: { id: tenantId }, data: { onboardedAt: new Date() } });
  }
}
