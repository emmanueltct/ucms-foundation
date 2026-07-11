import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationTemplate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';

const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

@Injectable()
export class NotificationTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateNotificationTemplateDto): Promise<NotificationTemplate> {
    const existing = await this.prisma.notificationTemplate.findUnique({ where: { tenantId_key: { tenantId, key: dto.key } } });
    if (existing) {
      throw new ConflictException({ code: 'NOTIFICATION_TEMPLATE_KEY_TAKEN', message: `A template with key "${dto.key}" already exists.` });
    }
    return this.prisma.notificationTemplate.create({ data: { tenantId, ...dto } });
  }

  async findAll(tenantId: string): Promise<NotificationTemplate[]> {
    return this.prisma.notificationTemplate.findMany({ where: { tenantId }, orderBy: { key: 'asc' } });
  }

  async findByKey(tenantId: string, key: string): Promise<NotificationTemplate | null> {
    return this.prisma.notificationTemplate.findUnique({ where: { tenantId_key: { tenantId, key } } });
  }

  async update(tenantId: string, id: string, dto: UpdateNotificationTemplateDto): Promise<NotificationTemplate> {
    await this.findOneOrThrow(tenantId, id);
    return this.prisma.notificationTemplate.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string): Promise<{ id: string }> {
    await this.findOneOrThrow(tenantId, id);
    await this.prisma.notificationTemplate.delete({ where: { id } });
    return { id };
  }

  /** `{{placeholder}}` substitution — unresolved tokens are left as-is (see schema comment on NotificationTemplate). */
  render(text: string, variables: Record<string, string> = {}): string {
    return text.replace(PLACEHOLDER_PATTERN, (match, name) => (name in variables ? variables[name] : match));
  }

  private async findOneOrThrow(tenantId: string, id: string): Promise<NotificationTemplate> {
    const template = await this.prisma.notificationTemplate.findFirst({ where: { id, tenantId } });
    if (!template) throw new NotFoundException({ code: 'NOTIFICATION_TEMPLATE_NOT_FOUND', message: 'Template not found.' });
    return template;
  }
}
