import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ConfigService } from './config.service';
import { CreateConfigItemDto } from './dto/create-config-item.dto';
import { UpdateConfigItemDto } from './dto/update-config-item.dto';
import { SetFeatureToggleDto } from './dto/set-feature-toggle.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('config-engine')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @ApiOperation({ summary: 'Create a namespaced config item' })
  @Permissions('config.item.create')
  @Post('items')
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateConfigItemDto) {
    return ok(await this.configService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List items in a namespace, e.g. ?namespace=contribution_type' })
  @ApiQuery({ name: 'namespace', example: 'contribution_type' })
  @ApiQuery({ name: 'includeInactive', required: false, example: 'false' })
  @Permissions('config.item.read')
  @Get('items')
  async findByNamespace(
    @CurrentTenantId() tenantId: string,
    @Query('namespace') namespace: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return ok(await this.configService.findByNamespace(tenantId, namespace, includeInactive === 'true'));
  }

  @ApiOperation({ summary: 'Get one config item' })
  @Permissions('config.item.read')
  @Get('items/:id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.configService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update label/value/sortOrder' })
  @Permissions('config.item.update')
  @Patch('items/:id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateConfigItemDto) {
    return ok(await this.configService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Soft-disable a config item (never hard-deleted)' })
  @Permissions('config.item.update')
  @Patch('items/:id/deactivate')
  async deactivate(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.configService.deactivate(tenantId, id));
  }

  @ApiOperation({ summary: 'Re-enable a previously deactivated config item' })
  @Permissions('config.item.update')
  @Patch('items/:id/reactivate')
  async reactivate(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.configService.reactivate(tenantId, id));
  }

  @ApiOperation({ summary: "List this tenant's feature toggles" })
  @Permissions('config.feature.read')
  @Get('features')
  async listFeatureToggles(@CurrentTenantId() tenantId: string) {
    return ok(await this.configService.listFeatureToggles(tenantId));
  }

  @ApiOperation({ summary: 'Enable/disable a named feature' })
  @Permissions('config.feature.update')
  @Post('features')
  async setFeatureToggle(@CurrentTenantId() tenantId: string, @Body() dto: SetFeatureToggleDto) {
    return ok(await this.configService.setFeatureToggle(tenantId, dto.featureKey, dto.isEnabled));
  }
}
