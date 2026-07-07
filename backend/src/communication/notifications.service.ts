import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
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
  ) {}

  async create(tenantId: string, createdByUserId: string | undefined, dto: CreateNotificationDto): Promise<Notification> {
    const recipient = await this.resolveRecipient(tenantId, dto);

    const notification = await this.prisma.notification.create({
      data: {
        tenantId,
        channel: dto.channel,
        recipientMemberId: dto.memberId ?? null,
        recipient,
        subject: dto.subject,
        body: dto.body,
        status: 'queued',
        createdByUserId,
      },
    });

    await this.queueService.enqueueNotification({
      notificationId: notification.id,
      tenantId,
      channel: dto.channel,
      recipient,
      subject: dto.subject,
      body: dto.body,
    });

    return notification;
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

    if (!dto.memberId) {
      throw new BadRequestException({
        code: 'NOTIFICATION_RECIPIENT_REQUIRED',
        message: 'Provide either a recipient or a memberId to resolve one from.',
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
