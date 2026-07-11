import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { TenantProfileService } from './tenant-profile.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

/**
 * The current tenant's own view of itself — distinct from TenantsController
 * (`/platform/tenants`), which is the Platform Admin's cross-tenant
 * management surface. These routes run through the normal
 * TenantContextMiddleware, so `@CurrentTenantId()` resolves the same way it
 * does for every other tenant-scoped module.
 */
@ApiTags('tenant-profile')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('tenant')
export class TenantProfileController {
  constructor(private readonly tenantProfileService: TenantProfileService) {}

  @ApiOperation({ summary: "Get the current user's own tenant profile (branding, plan, onboarding status)" })
  @Permissions('tenant.profile.read')
  @Get()
  async getProfile(@CurrentTenantId() tenantId: string) {
    return ok(await this.tenantProfileService.getProfile(tenantId));
  }

  @ApiOperation({
    summary: 'Final onboarding wizard step — ensures a headquarters branch exists and marks onboarding complete',
  })
  @Permissions('tenant.profile.update')
  @Patch('onboarding/complete')
  async completeOnboarding(@CurrentTenantId() tenantId: string, @Body() dto: CompleteOnboardingDto) {
    return ok(await this.tenantProfileService.completeOnboarding(tenantId, dto));
  }

  @ApiOperation({ summary: "Update the current church's branding (logo, theme colors, custom domain)" })
  @Permissions('tenant.profile.update')
  @Patch('branding')
  async updateBranding(@CurrentTenantId() tenantId: string, @Body() dto: UpdateTenantBrandingDto) {
    return ok(await this.tenantProfileService.updateBranding(tenantId, dto));
  }
}
