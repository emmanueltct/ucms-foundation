import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { TrashService } from './trash.service';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

/**
 * No static `@Permissions()` here — which permission code applies depends on
 * the `:resource` route param, so `TrashService` checks `user.permissions`
 * directly per-resource (same reasoning as `DynamicModuleRecordsController`).
 */
@ApiTags('trash')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('trash')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @ApiOperation({ summary: 'List which trash resources this user can view (drives Configuration Center Trash tabs)' })
  @Get()
  listResources(@CurrentUser() user: AuthenticatedUser) {
    return ok(this.trashService.listResources(user));
  }

  @ApiOperation({ summary: 'List soft-deleted rows for one resource, most recently deleted first' })
  @Get(':resource')
  async list(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('resource') resource: string) {
    return ok(await this.trashService.list(tenantId, resource, user));
  }

  @ApiOperation({ summary: 'Restore a soft-deleted row' })
  @Patch(':resource/:id/restore')
  async restore(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    return ok(await this.trashService.restore(tenantId, resource, id, user));
  }
}
