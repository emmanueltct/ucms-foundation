import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SecuritySettingsService } from './security-settings.service';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('security-settings')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('security-settings')
export class SecuritySettingsController {
  constructor(private readonly service: SecuritySettingsService) {}

  @ApiOperation({ summary: "This church's configured session/token security settings (nulls mean 'using the platform default')" })
  @Permissions('securitysettings.read')
  @Get()
  async get(@CurrentTenantId() tenantId: string) {
    return ok(await this.service.getConfigured(tenantId));
  }

  @ApiOperation({ summary: 'Update session expiration, inactivity auto-logout, and/or max concurrent sessions for this church' })
  @Permissions('securitysettings.update')
  @Patch()
  async update(@CurrentTenantId() tenantId: string, @Body() dto: UpdateSecuritySettingsDto) {
    return ok(await this.service.update(tenantId, dto));
  }
}
