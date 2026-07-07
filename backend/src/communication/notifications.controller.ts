import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('communication')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Send a notification (email/sms/push) to a member or an explicit recipient' })
  @Permissions('communication.notification.create')
  @Post()
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNotificationDto,
  ) {
    return ok(await this.notificationsService.create(tenantId, user?.userId, dto));
  }

  @ApiOperation({ summary: 'List notification history (paginated, filterable by channel/status/member)' })
  @Permissions('communication.notification.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: NotificationQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.notificationsService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one notification' })
  @Permissions('communication.notification.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.notificationsService.findOne(tenantId, id));
  }
}
