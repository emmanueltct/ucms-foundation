import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CustomFieldDefinitionsService } from './custom-field-definitions.service';
import { CreateCustomFieldDefinitionDto } from './dto/create-custom-field-definition.dto';
import { UpdateCustomFieldDefinitionDto } from './dto/update-custom-field-definition.dto';
import { CustomFieldDefinitionQueryDto } from './dto/custom-field-definition-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('custom-fields')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('custom-field-definitions')
export class CustomFieldDefinitionsController {
  constructor(private readonly definitionsService: CustomFieldDefinitionsService) {}

  @ApiOperation({ summary: 'Define a new custom field on an entity type (e.g. "member")' })
  @Permissions('customfield.definition.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateCustomFieldDefinitionDto) {
    return ok(await this.definitionsService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List custom field definitions (optionally filtered by entity type)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @Permissions('customfield.definition.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: CustomFieldDefinitionQueryDto) {
    return ok(await this.definitionsService.findAll(tenantId, query.entityType, query.includeInactive));
  }

  @ApiOperation({ summary: 'Get one custom field definition' })
  @Permissions('customfield.definition.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.definitionsService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update a custom field definition (label/options/required/sort order)' })
  @Permissions('customfield.definition.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateCustomFieldDefinitionDto) {
    return ok(await this.definitionsService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Retire a custom field (hides it from forms; existing values remain valid history)' })
  @Permissions('customfield.definition.delete')
  @Patch(':id/deactivate')
  async deactivate(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.definitionsService.deactivate(tenantId, id));
  }

  @ApiOperation({ summary: 'Bring back a retired custom field' })
  @Permissions('customfield.definition.update')
  @Patch(':id/reactivate')
  async reactivate(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.definitionsService.reactivate(tenantId, id));
  }

  @ApiOperation({ summary: 'Soft-delete a custom field definition — restore from the Trash view' })
  @Permissions('customfield.definition.delete')
  @Delete(':id')
  async softDelete(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.definitionsService.softDelete(tenantId, id));
  }
}
