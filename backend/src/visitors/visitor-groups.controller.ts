import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { VisitorGroupsService } from './visitor-groups.service';
import { VisitorActivitiesService } from './visitor-activities.service';
import { CreateVisitorGroupDto } from './dto/create-visitor-group.dto';
import { UpdateVisitorGroupDto } from './dto/update-visitor-group.dto';
import { VisitorGroupQueryDto } from './dto/visitor-group-query.dto';
import { CreateVisitorActivityDto } from './dto/create-visitor-activity.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('visitor-groups')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('visitor-groups')
export class VisitorGroupsController {
  constructor(
    private readonly visitorGroupsService: VisitorGroupsService,
    private readonly visitorActivitiesService: VisitorActivitiesService,
  ) {}

  @ApiOperation({ summary: 'Record a visiting group (family, delegation, choir/youth visit, conference party, mission team, ...)' })
  @Permissions('visitor_group.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateVisitorGroupDto) {
    return ok(await this.visitorGroupsService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List visitor groups (paginated, filterable by branch/type/status/search)' })
  @Permissions('visitor_group.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: VisitorGroupQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.visitorGroupsService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one visitor group' })
  @Permissions('visitor_group.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.visitorGroupsService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update a visitor group' })
  @Permissions('visitor_group.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateVisitorGroupDto) {
    return ok(await this.visitorGroupsService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Soft-delete a visitor group (individual members are unaffected)' })
  @Permissions('visitor_group.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.visitorGroupsService.softDelete(tenantId, id));
  }

  @ApiOperation({ summary: 'List the individual visitors recorded as members of this group' })
  @Permissions('visitor_group.read')
  @Get(':id/members')
  async listMembers(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.visitorGroupsService.listMembers(tenantId, id));
  }

  @ApiOperation({ summary: 'Log a configurable activity against this whole group (e.g. "hosted the choir for evening service")' })
  @Permissions('visitor.activity.create')
  @Post(':id/activities')
  async addActivity(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateVisitorActivityDto,
  ) {
    await this.visitorActivitiesService.assertVisitorGroupExists(tenantId, id);
    return ok(await this.visitorActivitiesService.addActivity(tenantId, { visitorGroupId: id }, user?.userId, dto));
  }

  @ApiOperation({ summary: "List a group's activity history, most recent first" })
  @Permissions('visitor.activity.read')
  @Get(':id/activities')
  async listActivities(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.visitorActivitiesService.assertVisitorGroupExists(tenantId, id);
    return ok(await this.visitorActivitiesService.listActivities(tenantId, { visitorGroupId: id }));
  }
}
