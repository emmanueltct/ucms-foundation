import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { DeadlinesService } from './deadlines.service';
import { CreateDeadlineDto } from './dto/create-deadline.dto';
import { ExtendDeadlineDto } from './dto/extend-deadline.dto';
import { RequireReasonDto } from '../common/dto/require-reason.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiresAuditReason } from '../common/decorators/requires-audit-reason.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('deadlines')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('deadlines')
export class DeadlinesController {
  constructor(private readonly deadlinesService: DeadlinesService) {}

  @ApiOperation({ summary: 'Set a deadline against any (entityType, entityId) pair' })
  @Permissions('deadline.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateDeadlineDto) {
    return ok(await this.deadlinesService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'Get one entity\'s deadline, including its derived effectiveStatus (open/locked/closed)' })
  @Permissions('deadline.read')
  @Get(':entityType/:entityId')
  async findOne(@CurrentTenantId() tenantId: string, @Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return ok(await this.deadlinesService.findOne(tenantId, entityType, entityId));
  }

  @ApiOperation({ summary: 'Push a locked (overdue) deadline forward — requires a reason' })
  @Permissions('deadline.extend')
  @RequiresAuditReason()
  @Patch(':entityType/:entityId/extend')
  async extend(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: ExtendDeadlineDto,
  ) {
    return ok(await this.deadlinesService.extend(tenantId, entityType, entityId, user.userId, dto.dueAt, dto.reason));
  }

  @ApiOperation({ summary: 'Close a deadline — no further edits are possible until it is reopened' })
  @Permissions('deadline.close')
  @RequiresAuditReason()
  @Patch(':entityType/:entityId/close')
  async close(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: RequireReasonDto,
  ) {
    return ok(await this.deadlinesService.close(tenantId, entityType, entityId, user.userId, dto.reason));
  }

  @ApiOperation({ summary: 'Reopen a closed deadline — a separate, more sensitive permission than close' })
  @Permissions('deadline.reopen')
  @RequiresAuditReason()
  @Patch(':entityType/:entityId/reopen')
  async reopen(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: RequireReasonDto,
  ) {
    return ok(await this.deadlinesService.reopen(tenantId, entityType, entityId, user.userId, dto.reason));
  }
}
