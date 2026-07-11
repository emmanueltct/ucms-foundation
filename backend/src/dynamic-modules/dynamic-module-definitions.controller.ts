import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { DynamicModuleDefinitionsService } from './dynamic-module-definitions.service';
import { CreateDynamicModuleDefinitionDto } from './dto/create-dynamic-module-definition.dto';
import { UpdateDynamicModuleDefinitionDto } from './dto/update-dynamic-module-definition.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('dynamic-modules')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('dynamic-modules')
export class DynamicModuleDefinitionsController {
  constructor(private readonly service: DynamicModuleDefinitionsService) {}

  @ApiOperation({ summary: 'Define an entirely new functional module — no code change required' })
  @Permissions('dynamic_module.manage')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateDynamicModuleDefinitionDto) {
    return ok(await this.service.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List modules (?showInNav=true for the sidebar, ?includeInactive=true for the builder page)' })
  @Permissions('dynamic_module.read')
  @Get()
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Query('showInNav') showInNav?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return ok(
      await this.service.findAll(tenantId, {
        showInNav: showInNav === undefined ? undefined : showInNav === 'true',
        includeInactive: includeInactive === 'true',
      }),
    );
  }

  @ApiOperation({ summary: 'Get one module definition by its stable key' })
  @Permissions('dynamic_module.read')
  @Get('by-key/:key')
  async findByKey(@CurrentTenantId() tenantId: string, @Param('key') key: string) {
    return ok(await this.service.findByKey(tenantId, key));
  }

  @ApiOperation({ summary: 'Get one module definition' })
  @Permissions('dynamic_module.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update a module definition — its stable key cannot change' })
  @Permissions('dynamic_module.manage')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateDynamicModuleDefinitionDto) {
    return ok(await this.service.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Soft-delete a module definition — existing records are left as-is' })
  @Permissions('dynamic_module.manage')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.softDelete(tenantId, id));
  }
}
