import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { NotificationTemplatesService } from '../notification-templates/notification-templates.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

/**
 * Communication — see docs/communication/business-analysis.md. Creates a
 * `Notification` record (the durable, queryable history of what was sent)
 * and hands it to the existing QueueModule/BullMQ pipeline for async
 * dispatch, so a slow/flaky gateway can never block the request that
 * triggered a send.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly templates: NotificationTemplatesService,
  ) {}

  async create(tenantId: string, createdByUserId: string | undefined, dto: CreateNotificationDto): Promise<Notification> {
    const recipient = await this.resolveRecipient(tenantId, dto);
    const { subject, body } = await this.resolveContent(tenantId, dto);

    const notification = await this.prisma.notification.create({
      data: {
        tenantId,
        channel: dto.channel,
        recipientMemberId: dto.memberId ?? null,
        recipientUserId: dto.userId ?? null,
        recipient,
        subject,
        body,
        status: 'queued',
        createdByUserId,
      },
    });

    await this.queueService.enqueueNotification({
      notificationId: notification.id,
      tenantId,
      channel: dto.channel,
      recipient,
      subject,
      body,
    });

    return notification;
  }

  /**
   * `templateKey` (when given and resolvable) wins over ad-hoc subject/body
   * — the additive path requirement #6 asked for. Falls back to the
   * original ad-hoc fields unchanged when no template is given/found, so
   * every existing caller keeps working exactly as before.
   */
  private async resolveContent(tenantId: string, dto: CreateNotificationDto): Promise<{ subject?: string; body: string }> {
    if (dto.templateKey) {
      const template = await this.templates.findByKey(tenantId, dto.templateKey);
      if (template && template.isActive) {
        return {
          subject: template.subject ? this.templates.render(template.subject, dto.variables) : undefined,
          body: this.templates.render(template.body, dto.variables),
        };
      }
    }

    if (!dto.body) {
      throw new BadRequestException({
        code: 'NOTIFICATION_BODY_REQUIRED',
        message: 'Provide a body, or a templateKey that resolves to an active template.',
      });
    }
    return { subject: dto.subject, body: dto.body };
  }

  async findAll(tenantId: string, query: NotificationQueryDto) {
    const where = {
      tenantId,
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.memberId ? { recipientMemberId: query.memberId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<Notification> {
    const notification = await this.prisma.notification.findFirst({ where: { id, tenantId } });
    if (!notification) {
      throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found.' });
    }
    return notification;
  }

  /**
   * An explicit `recipient` always wins. Otherwise, for a named member, the
   * address is resolved from their profile — email from `Member.email`, sms
   * from `Member.phone`. Push has no device-token registry yet (a future
   * Mobile API concern), so it always requires an explicit `recipient`.
   */
  private async resolveRecipient(tenantId: string, dto: CreateNotificationDto): Promise<string> {
    if (dto.recipient) return dto.recipient;

    if (dto.channel === 'push') {
      throw new BadRequestException({
        code: 'NOTIFICATION_RECIPIENT_REQUIRED',
        message: 'Push notifications require an explicit recipient (device token) — there is no token registry yet.',
      });
    }

    if (dto.userId) {
      const user = await this.prisma.user.findFirst({ where: { id: dto.userId, tenantId, deletedAt: null } });
      if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
      const resolved = dto.channel === 'email' ? user.email : user.phone;
      if (!resolved) {
        throw new BadRequestException({
          code: 'NOTIFICATION_RECIPIENT_UNAVAILABLE',
          message: `This user has no ${dto.channel === 'email' ? 'email address' : 'phone number'} on file.`,
        });
      }
      return resolved;
    }

    if (!dto.memberId) {
      throw new BadRequestException({
        code: 'NOTIFICATION_RECIPIENT_REQUIRED',
        message: 'Provide a recipient, a memberId, or a userId to resolve one from.',
      });
    }

    const member = await this.prisma.member.findFirst({ where: { id: dto.memberId, tenantId, deletedAt: null } });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });

    const resolved = dto.channel === 'email' ? member.email : member.phone;
    if (!resolved) {
      throw new BadRequestException({
        code: 'NOTIFICATION_RECIPIENT_UNAVAILABLE',
        message: `This member has no ${dto.channel === 'email' ? 'email address' : 'phone number'} on file.`,
      });
    }
    return resolved;
  }
}
