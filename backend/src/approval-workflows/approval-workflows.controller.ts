import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiresAuditReason } from '../common/decorators/requires-audit-reason.decorator';
import { RequireReasonDto } from '../common/dto/require-reason.dto';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('approval-workflows')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('approval-workflows')
export class ApprovalWorkflowsController {
  constructor(private readonly approvalWorkflowsService: ApprovalWorkflowsService) {}

  @ApiOperation({ summary: 'Define an ordered approval chain for an entityType (e.g. "member_registration")' })
  @Permissions('approval_workflow.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateApprovalWorkflowDto) {
    return ok(await this.approvalWorkflowsService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List approval workflows (optionally filtered by entityType)' })
  @Permissions('approval_workflow.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query('entityType') entityType?: string) {
    return ok(await this.approvalWorkflowsService.findAll(tenantId, entityType));
  }

  @ApiOperation({ summary: "Get one entity's current approval request and step history" })
  @Permissions('approval_workflow.read')
  @Get('requests/:entityType/:entityId')
  async getRequest(
    @CurrentTenantId() tenantId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return ok(await this.approvalWorkflowsService.getRequest(tenantId, entityType, entityId));
  }

  @ApiOperation({ summary: "Approve the current step of an entity's pending approval request" })
  @Permissions('approval_workflow.decide')
  @RequiresAuditReason()
  @Patch('requests/:entityType/:entityId/approve')
  async approve(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: RequireReasonDto,
  ) {
    return ok(await this.approvalWorkflowsService.decide(tenantId, entityType, entityId, 'approved', user, dto.reason));
  }

  @ApiOperation({ summary: "Reject an entity's pending approval request" })
  @Permissions('approval_workflow.decide')
  @RequiresAuditReason()
  @Patch('requests/:entityType/:entityId/reject')
  async reject(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: RequireReasonDto,
  ) {
    return ok(await this.approvalWorkflowsService.decide(tenantId, entityType, entityId, 'rejected', user, dto.reason));
  }

  @ApiOperation({ summary: 'Get one approval workflow' })
  @Permissions('approval_workflow.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.approvalWorkflowsService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Rename or activate/deactivate an approval workflow' })
  @Permissions('approval_workflow.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateApprovalWorkflowDto) {
    return ok(await this.approvalWorkflowsService.update(tenantId, id, dto));
  }
}
