import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('users')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Create a user within the current tenant' })
  @Permissions('user.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateUserDto) {
    return ok(await this.usersService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List users (paginated, searchable)' })
  @Permissions('user.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: PaginationQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.usersService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one user' })
  @Permissions('user.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.usersService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update profile fields' })
  @Permissions('user.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return ok(await this.usersService.update(tenantId, id, dto));
  }

  @ApiOperation({
    summary:
      "Replace a user's role assignments — either a caller with user.update (any user, any role), or a Department Leader assigning only isDelegable roles to staff within their own department",
  })
  @Patch(':id/roles')
  async assignRoles(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
  ) {
    return ok(await this.usersService.assignRoles(tenantId, id, dto.roleIds, user));
  }

  @ApiOperation({ summary: 'Disable login for a user' })
  @Permissions('user.update')
  @Patch(':id/deactivate')
  async deactivate(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.usersService.deactivate(tenantId, id));
  }

  @ApiOperation({ summary: 'Re-enable login for a user — also doubles as "force account activation" when a user is otherwise stuck' })
  @Permissions('user.update')
  @Patch(':id/activate')
  async activate(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.usersService.activate(tenantId, id));
  }

  @ApiOperation({ summary: "Admin override: mark a user's email verified without the token flow (for when email verification is unavailable)" })
  @Permissions('user.update')
  @Patch(':id/force-verify-email')
  async forceVerifyEmail(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.usersService.forceVerifyEmail(tenantId, id));
  }

  @ApiOperation({
    summary:
      'Admin-forced password reset — generates a fresh one-time temporary password (share it out of band) and revokes the user\'s active sessions, for when they\'re locked out and the self-service forgot-password email is unavailable',
  })
  @Permissions('user.update')
  @Patch(':id/force-reset-password')
  async forcePasswordReset(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return ok(await this.usersService.forcePasswordReset(tenantId, id, user.userId));
  }

  @ApiOperation({ summary: 'Soft-delete a user' })
  @Permissions('user.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.usersService.softDelete(tenantId, id));
  }
}
