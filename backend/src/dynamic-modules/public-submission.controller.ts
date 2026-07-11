import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DynamicModuleRecordsService } from './dynamic-module-records.service';
import { CreateDynamicModuleRecordPublicDto } from './dto/create-dynamic-module-record-public.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ok } from '../common/interfaces/api-response.interface';

/**
 * Guest form submission — covers modules with no dedicated model yet
 * (prayer requests, service requests, custom forms). Mirrors
 * `members/register` exactly: `@Public()`, no `:tenantSlug` path segment
 * (tenant resolves via the X-Tenant-Slug header, same as every other
 * request — TenantContextMiddleware still runs for this route). Visitor
 * self-registration deliberately does NOT go through this generic path —
 * see `visitors.controller.ts`'s dedicated `/visitors/register` routes.
 */
@ApiTags('public-submissions')
@ApiSecurity('tenant-slug')
@Controller('modules')
export class PublicSubmissionController {
  constructor(private readonly records: DynamicModuleRecordsService) {}

  @ApiOperation({ summary: 'Public guest form submission for a module with allowPublicSubmission enabled' })
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':moduleKey/submit')
  async submit(@CurrentTenantId() tenantId: string, @Param('moduleKey') moduleKey: string, @Body() dto: CreateDynamicModuleRecordPublicDto) {
    return ok(await this.records.createPublic(tenantId, moduleKey, dto));
  }
}
