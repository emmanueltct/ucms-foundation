import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { QUEUE_NAMES } from './queue.constants';
import { NotificationJobData } from './notification-job.interface';

/**
 * Thin producer API over the notifications queue. The Communication module
 * (SMS/Email/Push) will call this instead of sending synchronously, so a
 * flaky SMS gateway can't block the request that triggered it.
 */
@Injectable()
export class QueueService {
  constructor(@InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue) {}

  enqueueNotification(data: NotificationJobData) {
    return this.notificationsQueue.add('send', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}
