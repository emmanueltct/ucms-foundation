import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { MoveBranchDto } from './dto/move-branch.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('branches')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @ApiOperation({ summary: 'Create a branch (root-level or nested under a parent)' })
  @Permissions('branch.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateBranchDto) {
    return ok(await this.branchesService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List branches as a flat, ordered list' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @Permissions('branch.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query('includeInactive') includeInactive?: string) {
    return ok(await this.branchesService.findAll(tenantId, includeInactive === 'true'));
  }

  @ApiOperation({ summary: 'Get the full hierarchy as a nested tree' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @Permissions('branch.read')
  @Get('tree')
  async findTree(@CurrentTenantId() tenantId: string, @Query('includeInactive') includeInactive?: string) {
    return ok(await this.branchesService.findTree(tenantId, includeInactive === 'true'));
  }

  @ApiOperation({ summary: 'Get one branch' })
  @Permissions('branch.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.branchesService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: "Get a branch's ancestor chain, immediate parent first" })
  @Permissions('branch.read')
  @Get(':id/ancestors')
  async findAncestors(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.branchesService.findAncestors(tenantId, id));
  }

  @ApiOperation({ summary: "Get all of a branch's descendants, flattened" })
  @Permissions('branch.read')
  @Get(':id/descendants')
  async findDescendants(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.branchesService.findDescendants(tenantId, id));
  }

  @ApiOperation({ summary: 'Rename / change type, code, address, sort order, or headquarters flag' })
  @Permissions('branch.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return ok(await this.branchesService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Move a branch to a new parent (or to the root), rejecting circular references' })
  @Permissions('branch.move')
  @Patch(':id/move')
  async move(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: MoveBranchDto) {
    return ok(await this.branchesService.move(tenantId, id, dto.parentBranchId));
  }

  @ApiOperation({ summary: 'Soft-deactivate this branch and all its descendants' })
  @Permissions('branch.update')
  @Patch(':id/deactivate')
  async deactivate(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.branchesService.deactivate(tenantId, id));
  }

  @ApiOperation({ summary: 'Reactivate this branch (does not cascade to descendants)' })
  @Permissions('branch.update')
  @Patch(':id/reactivate')
  async reactivate(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.branchesService.reactivate(tenantId, id));
  }

  @ApiOperation({ summary: 'Soft-delete this branch and all its descendants — restore from the Trash view' })
  @Permissions('branch.update')
  @Delete(':id')
  async softDelete(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.branchesService.softDelete(tenantId, id));
  }
}
