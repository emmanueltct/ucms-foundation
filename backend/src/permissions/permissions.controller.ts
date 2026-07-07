import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { Permissions as RequirePermissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @ApiOperation({ summary: 'List permission codes, optionally filtered by module' })
  @ApiQuery({ name: 'module', required: false, example: 'finance' })
  @RequirePermissions('role.read')
  @Get()
  async findAll(@Query('module') module?: string) {
    return ok(await this.permissionsService.findAll(module));
  }

  @ApiOperation({ summary: 'List distinct module names in the permission catalog' })
  @RequirePermissions('role.read')
  @Get('modules')
  async findModules() {
    return ok(await this.permissionsService.findModules());
  }
}
