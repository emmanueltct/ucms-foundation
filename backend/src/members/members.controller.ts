import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MembersService } from './members.service';
import { MemberActivitiesService } from './member-activities.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { TransferMemberDto } from './dto/transfer-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { CreateMemberActivityDto } from './dto/create-member-activity.dto';
import { RegisterMemberDto } from './dto/register-member.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequiresAuditReason } from '../common/decorators/requires-audit-reason.decorator';
import { RequireReasonDto } from '../common/dto/require-reason.dto';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';
import { ExportFormat, sendExportFile } from '../common/exports/export.util';
import { BranchScopeService } from '../common/branch-scope/branch-scope.service';

const MEMBER_EXPORT_COLUMNS = [
  { key: 'membershipNumber', header: 'Membership Number' },
  { key: 'firstName', header: 'First Name' },
  { key: 'lastName', header: 'Last Name' },
  { key: 'phone', header: 'Phone' },
  { key: 'email', header: 'Email' },
  { key: 'membershipStatus', header: 'Status' },
  { key: 'membershipCategory', header: 'Category' },
];

@ApiTags('members')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('members')
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly memberActivitiesService: MemberActivitiesService,
    private readonly branchScopeService: BranchScopeService,
  ) {}

  @ApiOperation({ summary: 'Create a member profile attached to a branch' })
  @Permissions('member.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateMemberDto) {
    return ok(await this.membersService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'Public list of active branches, for the self-registration Church/Branch/Parish/Cell/Work Group picker' })
  @Public()
  @Get('register/branches')
  async registerBranchOptions(@CurrentTenantId() tenantId: string) {
    return ok(await this.membersService.listBranchOptionsForRegistration(tenantId));
  }

  @ApiOperation({ summary: 'Public self-registration — creates a pending member awaiting approval; choose the Church/Branch/Parish/Cell/Work Group being joined' })
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@CurrentTenantId() tenantId: string, @Body() dto: RegisterMemberDto) {
    return ok(await this.membersService.registerPublic(tenantId, dto));
  }

  @ApiOperation({ summary: 'List members (paginated, searchable, filterable by branch/family/status) — scoped to the caller\'s assigned branch and its descendants, if any' })
  @Permissions('member.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Query() query: MemberQueryDto) {
    const visibleBranchIds = await this.branchScopeService.resolveVisibleBranchIds(tenantId, user.userId);
    const { items, total, page, pageSize, totalPages } = await this.membersService.findAll(tenantId, query, visibleBranchIds);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Download the member list (same filters as the list endpoint) as CSV/XLSX/PDF (?format=), up to 5000 rows' })
  @Permissions('member.read')
  @Get('export')
  async exportMembers(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MemberQueryDto & { format?: ExportFormat },
    @Res() res: Response,
  ) {
    const visibleBranchIds = await this.branchScopeService.resolveVisibleBranchIds(tenantId, user.userId);
    const items = await this.membersService.findAllForExport(tenantId, query, visibleBranchIds);
    await sendExportFile(res, query.format ?? 'csv', 'members', [{ title: 'Members', columns: MEMBER_EXPORT_COLUMNS, rows: items }], 'Members');
  }

  @ApiOperation({ summary: 'Get one member' })
  @Permissions('member.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.membersService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update profile fields (not branch — use transfer). A reason is required whenever membershipStatus is included' })
  @Permissions('member.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return ok(await this.membersService.update(tenantId, id, dto, user?.userId));
  }

  @ApiOperation({ summary: 'Move a member to a different branch' })
  @Permissions('member.transfer')
  @Patch(':id/transfer')
  async transfer(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: TransferMemberDto) {
    return ok(await this.membersService.transfer(tenantId, id, dto.branchId));
  }

  @ApiOperation({ summary: 'Approve a pending registration — reason required; routed through a tenant-defined approval workflow when one is configured for "member_registration"' })
  @Permissions('member.registration.decide')
  @RequiresAuditReason()
  @Patch(':id/approve')
  async approve(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RequireReasonDto) {
    return ok(await this.membersService.approve(tenantId, id, user, dto.reason));
  }

  @ApiOperation({ summary: 'Reject a pending registration — reason required' })
  @Permissions('member.registration.decide')
  @RequiresAuditReason()
  @Patch(':id/reject')
  async reject(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RequireReasonDto) {
    return ok(await this.membersService.reject(tenantId, id, user, dto.reason));
  }

  @ApiOperation({ summary: 'Soft-delete a member — reason required' })
  @Permissions('member.delete')
  @RequiresAuditReason()
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RequireReasonDto) {
    return ok(await this.membersService.softDelete(tenantId, id, user.userId, dto.reason));
  }

  @ApiOperation({ summary: 'Log a configurable activity (sacrament, training, certificate, leadership appointment, ...) against this member' })
  @Permissions('member.activity.create')
  @Post(':id/activities')
  async addActivity(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateMemberActivityDto,
  ) {
    return ok(await this.memberActivitiesService.addActivity(tenantId, id, user?.userId, dto));
  }

  @ApiOperation({ summary: "List a member's logged activity history, most recent first" })
  @Permissions('member.activity.read')
  @Get(':id/activities')
  async listActivities(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.memberActivitiesService.listActivities(tenantId, id));
  }
}
