import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { MinistriesService } from './ministries.service';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';
import { MinistryQueryDto } from './dto/ministry-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';
import { BranchScopeService } from '../common/branch-scope/branch-scope.service';

@ApiTags('ministries')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('ministries')
export class MinistriesController {
  constructor(
    private readonly ministriesService: MinistriesService,
    private readonly branchScopeService: BranchScopeService,
  ) {}

  @ApiOperation({ summary: 'Create a ministry (church-wide or scoped to a branch)' })
  @Permissions('ministry.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateMinistryDto) {
    return ok(await this.ministriesService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List ministries (paginated, searchable, filterable by branch/type) — a branch-scoped caller also sees church-wide ministries' })
  @Permissions('ministry.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Query() query: MinistryQueryDto) {
    const visibleBranchIds = await this.branchScopeService.resolveVisibleBranchIds(tenantId, user.userId);
    const { items, total, page, pageSize, totalPages } = await this.ministriesService.findAll(tenantId, query, visibleBranchIds);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one ministry' })
  @Permissions('ministry.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.ministriesService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update a ministry' })
  @Permissions('ministry.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateMinistryDto) {
    return ok(await this.ministriesService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Soft-delete a ministry and deactivate its volunteer memberships' })
  @Permissions('ministry.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.ministriesService.softDelete(tenantId, id));
  }
}
