import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('roles')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({ summary: 'Create a tenant-defined role from permission codes' })
  @Permissions('role.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateRoleDto) {
    return ok(await this.rolesService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List roles with their permissions' })
  @Permissions('role.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string) {
    return ok(await this.rolesService.findAll(tenantId));
  }

  @ApiOperation({ summary: 'Get one role' })
  @Permissions('role.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.rolesService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Rename / change permission set (system roles locked)' })
  @Permissions('role.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return ok(await this.rolesService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Delete a custom role (system roles locked)' })
  @Permissions('role.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.rolesService.remove(tenantId, id));
  }
}
