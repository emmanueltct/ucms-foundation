import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { VisitorsService } from './visitors.service';
import { VisitorActivitiesService } from './visitor-activities.service';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { VisitorQueryDto } from './dto/visitor-query.dto';
import { CreateVisitorActivityDto } from './dto/create-visitor-activity.dto';
import { ConvertVisitorDto } from './dto/convert-visitor.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';
import { ExportFormat, sendExportFile } from '../common/exports/export.util';

const VISITOR_EXPORT_COLUMNS = [
  { key: 'firstName', header: 'First Name' },
  { key: 'lastName', header: 'Last Name' },
  { key: 'phone', header: 'Phone' },
  { key: 'email', header: 'Email' },
  { key: 'visitDate', header: 'Visit Date' },
  { key: 'source', header: 'Source' },
  { key: 'status', header: 'Status' },
];

@ApiTags('visitors')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('visitors')
export class VisitorsController {
  constructor(
    private readonly visitorsService: VisitorsService,
    private readonly visitorActivitiesService: VisitorActivitiesService,
  ) {}

  @ApiOperation({ summary: 'Record a first-time visitor' })
  @Permissions('visitor.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateVisitorDto) {
    return ok(await this.visitorsService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List visitors (paginated, filterable by branch/status/assignee/search)' })
  @Permissions('visitor.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: VisitorQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.visitorsService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Download the visitor list (same filters as the list endpoint) as CSV/XLSX/PDF (?format=), up to 5000 rows' })
  @Permissions('visitor.read')
  @Get('export')
  async exportVisitors(
    @CurrentTenantId() tenantId: string,
    @Query() query: VisitorQueryDto & { format?: ExportFormat },
    @Res() res: Response,
  ) {
    const items = await this.visitorsService.findAllForExport(tenantId, query);
    await sendExportFile(res, query.format ?? 'csv', 'visitors', [{ title: 'Visitors', columns: VISITOR_EXPORT_COLUMNS, rows: items }], 'Visitors');
  }

  @ApiOperation({ summary: 'Get one visitor' })
  @Permissions('visitor.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.visitorsService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: "Update a visitor (status changes accepted here except \"joined\" — see /convert)" })
  @Permissions('visitor.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateVisitorDto) {
    return ok(await this.visitorsService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Soft-delete a visitor' })
  @Permissions('visitor.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.visitorsService.softDelete(tenantId, id));
  }

  @ApiOperation({ summary: 'Link this visitor to an already-created Member and mark them "joined"' })
  @Permissions('visitor.convert')
  @Patch(':id/convert')
  async convert(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: ConvertVisitorDto) {
    return ok(await this.visitorsService.convertToMember(tenantId, id, dto.memberId));
  }

  @ApiOperation({ summary: 'Log a configurable activity (First Visit, Counseling, Prayer, Follow-up, ...) against this visitor' })
  @Permissions('visitor.activity.create')
  @Post(':id/activities')
  async addActivity(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateVisitorActivityDto,
  ) {
    await this.visitorActivitiesService.assertVisitorExists(tenantId, id);
    return ok(await this.visitorActivitiesService.addActivity(tenantId, { visitorId: id }, user?.userId, dto));
  }

  @ApiOperation({ summary: "List a visitor's activity history, most recent first" })
  @Permissions('visitor.activity.read')
  @Get(':id/activities')
  async listActivities(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.visitorActivitiesService.assertVisitorExists(tenantId, id);
    return ok(await this.visitorActivitiesService.listActivities(tenantId, { visitorId: id }));
  }
}
