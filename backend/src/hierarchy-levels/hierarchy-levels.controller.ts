import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { HierarchyLevelsService } from './hierarchy-levels.service';
import { CreateHierarchyLevelDefinitionDto } from './dto/create-hierarchy-level-definition.dto';
import { UpdateHierarchyLevelDefinitionDto } from './dto/update-hierarchy-level-definition.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('hierarchy-levels')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('hierarchy-levels')
export class HierarchyLevelsController {
  constructor(private readonly service: HierarchyLevelsService) {}

  @ApiOperation({ summary: 'Define a nesting rule for a branch type (which types may be its parent/child)' })
  @Permissions('hierarchylevel.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateHierarchyLevelDefinitionDto) {
    return ok(await this.service.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List hierarchy level rules' })
  @Permissions('hierarchylevel.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string) {
    return ok(await this.service.findAll(tenantId));
  }

  @ApiOperation({ summary: 'Update a hierarchy level rule' })
  @Permissions('hierarchylevel.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateHierarchyLevelDefinitionDto) {
    return ok(await this.service.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Remove a hierarchy level rule (the branch type reverts to unconstrained nesting)' })
  @Permissions('hierarchylevel.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.remove(tenantId, id));
  }
}
