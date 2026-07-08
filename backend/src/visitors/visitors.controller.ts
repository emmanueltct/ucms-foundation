import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { VisitorsService } from './visitors.service';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { VisitorQueryDto } from './dto/visitor-query.dto';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { ConvertVisitorDto } from './dto/convert-visitor.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('visitors')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

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

  @ApiOperation({ summary: 'Log a follow-up interaction (call, message, visit) with this visitor' })
  @Permissions('visitor.followup.create')
  @Post(':id/follow-ups')
  async addFollowUp(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateFollowUpDto,
  ) {
    return ok(await this.visitorsService.addFollowUp(tenantId, id, user?.userId, dto));
  }

  @ApiOperation({ summary: "List a visitor's follow-up history, most recent first" })
  @Permissions('visitor.followup.read')
  @Get(':id/follow-ups')
  async listFollowUps(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.visitorsService.listFollowUps(tenantId, id));
  }
}
