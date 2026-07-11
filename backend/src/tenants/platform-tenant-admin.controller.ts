import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { ReportsService } from '../reports/reports.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

/**
 * Platform-Admin-only, cross-tenant surface for the two things a Platform
 * Admin needs when a church's own admin is unreachable or locked out:
 * managing that tenant's users, and seeing the tenant's health at a glance.
 * `UsersService`/`ReportsService` already take `tenantId` as an explicit
 * param (not derived from request context), so this calls them directly
 * with the `:id` route param — no service changes needed, see the plan's
 * Design Decision notes.
 */
@ApiTags('platform-tenants')
@ApiBearerAuth()
@Controller('platform/tenants/:id')
export class PlatformTenantAdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly reportsService: ReportsService,
  ) {}

  @ApiOperation({ summary: "List a church's users (paginated, searchable)" })
  @Permissions('platform.tenant.read')
  @Get('users')
  async listUsers(@Param('id') tenantId: string, @Query() query: PaginationQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.usersService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: "Get one of a church's users" })
  @Permissions('platform.tenant.read')
  @Get('users/:userId')
  async getUser(@Param('id') tenantId: string, @Param('userId') userId: string) {
    return ok(await this.usersService.findOne(tenantId, userId));
  }

  @ApiOperation({ summary: 'Force-verify a user\'s email — for when the church admin themselves is locked out and email verification is unavailable' })
  @Permissions('platform.tenant.update')
  @Patch('users/:userId/force-verify-email')
  async forceVerifyEmail(@Param('id') tenantId: string, @Param('userId') userId: string) {
    return ok(await this.usersService.forceVerifyEmail(tenantId, userId));
  }

  @ApiOperation({ summary: 'Force-activate a user — for when the church admin themselves is locked out' })
  @Permissions('platform.tenant.update')
  @Patch('users/:userId/force-activate')
  async forceActivate(@Param('id') tenantId: string, @Param('userId') userId: string) {
    return ok(await this.usersService.activate(tenantId, userId));
  }

  @ApiOperation({ summary: "A church's overall health snapshot — members, staff, branches, upcoming events, giving and attendance" })
  @Permissions('platform.tenant.read')
  @Get('health')
  async health(@Param('id') tenantId: string) {
    return ok(await this.reportsService.overview(tenantId));
  }
}
