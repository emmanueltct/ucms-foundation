import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { QUEUE_NAMES } from './queue.constants';
import { NotificationJobData } from './notification-job.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Dispatch is a documented stub: it logs the job rather than calling a real
 * SMS/Email/Push gateway (no MTN-style/SES/FCM credentials exist in this
 * environment), but the rest of the pipeline is real — the corresponding
 * `Notification` row's `status` is updated to "sent"/"failed" here, so
 * callers can tell a message was actually processed from one that's still
 * queued. Swapping the log line for a real gateway call later doesn't touch
 * anything else in this pipeline.
 */
@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    // Runs outside any HTTP request, so there's no AsyncLocalStorage tenant context for the
    // Prisma tenant-scoping extension to read — tenantId must be passed explicitly in `where`.
    const { notificationId, tenantId } = job.data;
    try {
      this.logger.log(`[${job.data.channel}] would send to ${job.data.recipient}: "${job.data.body}"`);
      await this.prisma.notification.update({
        where: { id: notificationId, tenantId },
        data: { status: 'sent', sentAt: new Date() },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notificationId, tenantId },
        data: { status: 'failed', errorMessage: error instanceof Error ? error.message : 'Unknown error' },
      });
      throw error; // let BullMQ's retry/backoff still apply
    }
  }
}
