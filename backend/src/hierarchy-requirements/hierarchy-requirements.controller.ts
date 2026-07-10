import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { HierarchyRequirementsService } from './hierarchy-requirements.service';
import { CreateHierarchyRequirementDto } from './dto/create-hierarchy-requirement.dto';
import { UpdateHierarchyRequirementDto } from './dto/update-hierarchy-requirement.dto';
import { CreateSubmissionDto, SubmitSubmissionDto } from './dto/create-submission.dto';
import { RequireReasonDto } from '../common/dto/require-reason.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiresAuditReason } from '../common/decorators/requires-audit-reason.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('hierarchy-requirements')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('hierarchy-requirements')
export class HierarchyRequirementsController {
  constructor(private readonly service: HierarchyRequirementsService) {}

  @ApiOperation({ summary: "Define a parent level's requirement of a child level (e.g. Diocese requires a monthly report from each District)" })
  @Permissions('hierarchy_requirement.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateHierarchyRequirementDto) {
    return ok(await this.service.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List requirements, optionally filtered by parentBranchType/childBranchType/kind' })
  @Permissions('hierarchy_requirement.read')
  @Get()
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Query('parentBranchType') parentBranchType?: string,
    @Query('childBranchType') childBranchType?: string,
    @Query('kind') kind?: string,
  ) {
    return ok(await this.service.findAll(tenantId, { parentBranchType, childBranchType, kind }));
  }

  @ApiOperation({ summary: "What a branch's parent level requires of it — the 'requirements owed upward' widget query" })
  @Permissions('hierarchy_requirement.read')
  @Get('for-branch/:branchId')
  async listForBranch(@CurrentTenantId() tenantId: string, @Param('branchId') branchId: string) {
    return ok(await this.service.listForBranch(tenantId, branchId));
  }

  @ApiOperation({ summary: "A branch's own submission history across all requirements" })
  @Permissions('hierarchy_requirement.submission.read')
  @Get('submissions/branch/:branchId')
  async listSubmissionsForBranch(@CurrentTenantId() tenantId: string, @Param('branchId') branchId: string) {
    return ok(await this.service.listSubmissionsForBranch(tenantId, branchId));
  }

  @ApiOperation({ summary: 'Mark a submission as submitted, attaching evidence documents' })
  @Permissions('hierarchy_requirement.submission.submit')
  @Patch('submissions/:id/submit')
  async submit(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SubmitSubmissionDto) {
    return ok(await this.service.submit(tenantId, id, user.userId, dto));
  }

  @ApiOperation({ summary: 'Approve a submitted submission — requires a reason' })
  @Permissions('hierarchy_requirement.submission.decide')
  @RequiresAuditReason()
  @Patch('submissions/:id/approve')
  async approve(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RequireReasonDto) {
    return ok(await this.service.decide(tenantId, id, 'approved', user, dto.reason));
  }

  @ApiOperation({ summary: 'Reject a submitted submission — requires a reason' })
  @Permissions('hierarchy_requirement.submission.decide')
  @RequiresAuditReason()
  @Patch('submissions/:id/reject')
  async reject(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RequireReasonDto) {
    return ok(await this.service.decide(tenantId, id, 'rejected', user, dto.reason));
  }

  @ApiOperation({ summary: "A requirement's full submission history across all branches — the parent's oversight view" })
  @Permissions('hierarchy_requirement.submission.read')
  @Get(':id/submissions')
  async listSubmissionsForRequirement(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.listSubmissionsForRequirement(tenantId, id));
  }

  @ApiOperation({ summary: 'Open a new submission cycle for a branch against a requirement' })
  @Permissions('hierarchy_requirement.submission.create')
  @Post(':id/submissions')
  async createSubmission(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Query('branchId') branchId: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    return ok(await this.service.createSubmission(tenantId, id, branchId, dto));
  }

  @ApiOperation({ summary: 'Get one requirement' })
  @Permissions('hierarchy_requirement.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update a requirement' })
  @Permissions('hierarchy_requirement.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateHierarchyRequirementDto) {
    return ok(await this.service.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Soft-delete a requirement' })
  @Permissions('hierarchy_requirement.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.softDelete(tenantId, id));
  }
}
