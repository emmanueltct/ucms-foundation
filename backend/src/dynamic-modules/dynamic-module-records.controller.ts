import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { DynamicModuleRecordsService } from './dynamic-module-records.service';
import { CreateDynamicModuleRecordDto } from './dto/create-dynamic-module-record.dto';
import { UpdateDynamicModuleRecordDto } from './dto/update-dynamic-module-record.dto';
import { ChangeDynamicModuleRecordStatusDto } from './dto/change-status.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresAuditReason } from '../common/decorators/requires-audit-reason.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

/**
 * No `@Permissions()` here — a Dynamic Module's permission codes
 * (`dynamicmodule.{moduleDefinitionId}.{action}`) depend on the
 * `:moduleDefinitionId` route param, which the static `@Permissions()`
 * decorator can't express. `DynamicModuleRecordsService` checks
 * `user.permissions` directly instead. The global Jwt/Roles/PermissionsGuard
 * pipeline still runs — `PermissionsGuard` simply allows the request through
 * when a route declares no required permissions.
 */
@ApiTags('dynamic-modules')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('dynamic-modules/:moduleDefinitionId/records')
export class DynamicModuleRecordsController {
  constructor(private readonly service: DynamicModuleRecordsService) {}

  @ApiOperation({ summary: "Create a record — standalone, or attached to an existing entity" })
  @Post()
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('moduleDefinitionId') moduleDefinitionId: string,
    @Body() dto: CreateDynamicModuleRecordDto,
  ) {
    return ok(await this.service.create(tenantId, moduleDefinitionId, dto, user));
  }

  @ApiOperation({ summary: 'List records, optionally filtered by attachment, status, or branch' })
  @Get()
  async findAll(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('moduleDefinitionId') moduleDefinitionId: string,
    @Query('attachedToEntityType') attachedToEntityType?: string,
    @Query('attachedToEntityId') attachedToEntityId?: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
  ) {
    return ok(await this.service.findAll(tenantId, moduleDefinitionId, { attachedToEntityType, attachedToEntityId, status, branchId }, user));
  }

  @ApiOperation({ summary: 'Counts by status and by branch — the module\'s generic dashboard' })
  @Get('summary')
  async summary(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('moduleDefinitionId') moduleDefinitionId: string) {
    return ok(await this.service.summary(tenantId, moduleDefinitionId, user));
  }

  @ApiOperation({ summary: 'Change a record\'s status — reason required; routed through the approval workflow when configured and moving to approved/rejected' })
  @RequiresAuditReason()
  @Patch(':id/status')
  async changeStatus(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('moduleDefinitionId') moduleDefinitionId: string,
    @Param('id') id: string,
    @Body() dto: ChangeDynamicModuleRecordStatusDto,
  ) {
    return ok(await this.service.changeStatus(tenantId, moduleDefinitionId, id, dto, user));
  }

  @ApiOperation({ summary: "A record's status-change timeline" })
  @Get(':id/status-history')
  async statusHistory(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('moduleDefinitionId') moduleDefinitionId: string, @Param('id') id: string) {
    return ok(await this.service.statusHistory(tenantId, moduleDefinitionId, id, user));
  }

  @ApiOperation({ summary: 'Get one record' })
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('moduleDefinitionId') moduleDefinitionId: string, @Param('id') id: string) {
    return ok(await this.service.findOne(tenantId, moduleDefinitionId, id, user));
  }

  @ApiOperation({ summary: 'Update a record — title, branch, and/or custom fields' })
  @Patch(':id')
  async update(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('moduleDefinitionId') moduleDefinitionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDynamicModuleRecordDto,
  ) {
    return ok(await this.service.update(tenantId, moduleDefinitionId, id, dto, user));
  }

  @ApiOperation({ summary: 'Soft-delete a record' })
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('moduleDefinitionId') moduleDefinitionId: string, @Param('id') id: string) {
    return ok(await this.service.softDelete(tenantId, moduleDefinitionId, id, user));
  }
}
