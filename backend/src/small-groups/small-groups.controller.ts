import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SmallGroupsService } from './small-groups.service';
import { CreateSmallGroupDto } from './dto/create-small-group.dto';
import { UpdateSmallGroupDto } from './dto/update-small-group.dto';
import { SmallGroupQueryDto } from './dto/small-group-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('small-groups')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('small-groups')
export class SmallGroupsController {
  constructor(private readonly smallGroupsService: SmallGroupsService) {}

  @ApiOperation({ summary: 'Create a small group (church-wide or scoped to a branch)' })
  @Permissions('small_group.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateSmallGroupDto) {
    return ok(await this.smallGroupsService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List small groups (paginated, searchable, filterable by branch/type)' })
  @Permissions('small_group.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: SmallGroupQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.smallGroupsService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one small group' })
  @Permissions('small_group.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.smallGroupsService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update a small group' })
  @Permissions('small_group.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateSmallGroupDto) {
    return ok(await this.smallGroupsService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Soft-delete a small group and deactivate its roster' })
  @Permissions('small_group.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.smallGroupsService.softDelete(tenantId, id));
  }
}
