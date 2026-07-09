import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { MembersService } from './members.service';
import { MemberActivitiesService } from './member-activities.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { TransferMemberDto } from './dto/transfer-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { CreateMemberActivityDto } from './dto/create-member-activity.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('members')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('members')
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly memberActivitiesService: MemberActivitiesService,
  ) {}

  @ApiOperation({ summary: 'Create a member profile attached to a branch' })
  @Permissions('member.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateMemberDto) {
    return ok(await this.membersService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List members (paginated, searchable, filterable by branch/family/status)' })
  @Permissions('member.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: MemberQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.membersService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one member' })
  @Permissions('member.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.membersService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update profile fields (not branch — use transfer)' })
  @Permissions('member.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return ok(await this.membersService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Move a member to a different branch' })
  @Permissions('member.transfer')
  @Patch(':id/transfer')
  async transfer(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: TransferMemberDto) {
    return ok(await this.membersService.transfer(tenantId, id, dto.branchId));
  }

  @ApiOperation({ summary: 'Soft-delete a member' })
  @Permissions('member.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.membersService.softDelete(tenantId, id));
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
