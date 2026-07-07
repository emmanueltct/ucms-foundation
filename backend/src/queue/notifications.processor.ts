import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { QUEUE_NAMES } from './queue.constants';
import { NotificationJobData } from './notification-job.interface';

/**
 * Placeholder worker: logs the job so the queue is provably wired end to
 * end. Real SMS/Email/Push dispatch (MTN-style gateways, SES, FCM, etc.)
 * ships with the Communication module — this only proves the pipe works.
 */
@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job<NotificationJobData>): Promise<void> {
    this.logger.log(`[${job.data.channel}] would send to ${job.data.recipient}: "${job.data.body}"`);
  }
}
