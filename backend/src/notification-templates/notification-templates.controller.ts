import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { NotificationTemplatesService } from './notification-templates.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('notification-templates')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('notification-templates')
export class NotificationTemplatesController {
  constructor(private readonly service: NotificationTemplatesService) {}

  @ApiOperation({ summary: 'Create a reusable email/SMS/push template' })
  @Permissions('notification_template.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateNotificationTemplateDto) {
    return ok(await this.service.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List notification templates' })
  @Permissions('notification_template.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string) {
    return ok(await this.service.findAll(tenantId));
  }

  @ApiOperation({ summary: 'Update a notification template' })
  @Permissions('notification_template.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateNotificationTemplateDto) {
    return ok(await this.service.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Delete a notification template' })
  @Permissions('notification_template.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.remove(tenantId, id));
  }
}
