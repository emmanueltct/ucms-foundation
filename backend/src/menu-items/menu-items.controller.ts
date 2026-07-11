import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { MenuItemsService } from './menu-items.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('menu-items')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('menu-items')
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  @ApiOperation({ summary: 'Create a menu item (module/entity/report/dashboard/customPage/workflow target)' })
  @Permissions('menu.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateMenuItemDto) {
    return ok(await this.menuItemsService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List every configured menu item (admin view — unfiltered)' })
  @Permissions('menu.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string) {
    return ok(await this.menuItemsService.findAll(tenantId));
  }

  @ApiOperation({ summary: "The current user's own visible menu — filtered by role and branch scope" })
  @Get('for-current-user')
  async forCurrentUser(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return ok(await this.menuItemsService.forCurrentUser(tenantId, user));
  }

  @ApiOperation({ summary: 'Update a menu item' })
  @Permissions('menu.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return ok(await this.menuItemsService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Delete a menu item' })
  @Permissions('menu.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.menuItemsService.remove(tenantId, id));
  }
}
