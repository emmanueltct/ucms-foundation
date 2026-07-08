import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { QUEUE_NAMES } from './queue.constants';
import { QueueService } from './queue.service';
import { NotificationsProcessor } from './notifications.processor';

/**
 * Global Redis/BullMQ wiring. Registered once here; feature modules only
 * need `BullModule.registerQueue({ name: ... })` for their own queues.
 *
 * Connection is passed as plain options (not a pre-built ioredis instance)
 * so BullMQ creates it with its own bundled ioredis — mixing a top-level
 * `ioredis` instance with BullMQ's internal copy trips a TS structural
 * type mismatch between the two package copies.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>('REDIS_URL', 'redis://localhost:6379'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
            maxRetriesPerRequest: null, // required by BullMQ's blocking commands
            connectTimeout: 5_000,
            // Bounded, unlike ioredis's infinite-retry default: without this, an
            // unreachable Redis hangs `NestFactory.create()` forever instead of
            // failing with a message that says what's actually wrong.
            retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 500, 3_000)),
          },
        };
      },
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  providers: [QueueService, NotificationsProcessor],
  exports: [BullModule, QueueService],
})
export class QueueModule {}
