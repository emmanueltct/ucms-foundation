import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

/**
 * NOTE: These routes are Platform-Admin-only (see FR-3.5). In this module
 * they're gated by the `platform.tenant.*` permission codes; wiring
 * `isPlatformAdmin` end-to-end (a distinct login flow) ships with the
 * Platform Admin module. The permission checks below still apply the same
 * PermissionsGuard used everywhere else, so nothing is a special case.
 */
@ApiTags('platform-tenants')
@ApiBearerAuth()
@Controller('platform/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @ApiOperation({
    summary: 'Provision a new church (tenant)',
    description:
      'If `adminEmail` is provided, also bootstraps a "Church Administrator" role + user for that tenant and ' +
      'returns a one-time `temporaryPassword` — share it with the church out of band (no email delivery yet).',
  })
  @Permissions('platform.tenant.create')
  @Post()
  async create(@Body() dto: CreateTenantDto) {
    return ok(await this.tenantsService.create(dto));
  }

  @ApiOperation({ summary: 'List churches (paginated, searchable)' })
  @Permissions('platform.tenant.read')
  @Get()
  async findAll(@Query() query: PaginationQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.tenantsService.findAll(query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one church' })
  @Permissions('platform.tenant.read')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return ok(await this.tenantsService.findOne(id));
  }

  @ApiOperation({ summary: 'Update branding/locale/plan' })
  @Permissions('platform.tenant.update')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return ok(await this.tenantsService.update(id, dto));
  }

  @ApiOperation({ summary: 'Suspend a church — data is kept, sign-in stops working' })
  @Permissions('platform.tenant.update')
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    return ok(await this.tenantsService.deactivate(id));
  }

  @ApiOperation({ summary: 'Reactivate a suspended church' })
  @Permissions('platform.tenant.update')
  @Patch(':id/reactivate')
  async reactivate(@Param('id') id: string) {
    return ok(await this.tenantsService.reactivate(id));
  }

  @ApiOperation({ summary: 'Soft-delete a church' })
  @Permissions('platform.tenant.delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return ok(await this.tenantsService.softDelete(id));
  }

  @ApiOperation({ summary: 'Restore a soft-deleted church (still suspended — reactivate separately to fully restore sign-in)' })
  @Permissions('platform.tenant.update')
  @Patch(':id/restore')
  async restore(@Param('id') id: string) {
    return ok(await this.tenantsService.restore(id));
  }

  @ApiOperation({
    summary: 'Permanently delete a church and every row it owns — irreversible',
    description:
      'Only reachable once the church is already soft-deleted (DELETE :id). This is the second, deliberate step of ' +
      'a two-step destroy — there is no way to purge a still-live church in one call.',
  })
  @Permissions('platform.tenant.purge')
  @Delete(':id/purge')
  async purge(@Param('id') id: string) {
    return ok(await this.tenantsService.hardDelete(id));
  }
}
