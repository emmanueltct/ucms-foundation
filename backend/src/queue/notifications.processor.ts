import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';

import { QUEUE_NAMES } from './queue.constants';
import { NotificationJobData } from './notification-job.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Email dispatch is real whenever SMTP credentials are configured
 * (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM`, see
 * `.env.example`) — sent via `nodemailer` against any standard SMTP
 * provider (Gmail, SES SMTP, SendGrid SMTP, Mailgun, a real church mail
 * server, etc.). Without those env vars set, dispatch falls back to the
 * original documented stub (log the job, mark it "sent") so a fresh
 * checkout with no mail credentials keeps working exactly as before — SMS/
 * push have no equivalent gateway credentials in this environment and
 * always use that stub. The `Notification` row's `status` always reflects
 * what actually happened ("sent" only once real delivery succeeds, for
 * email; "failed" with `errorMessage` if the SMTP call itself fails).
 */
@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    // Runs outside any HTTP request, so there's no AsyncLocalStorage tenant context for the
    // Prisma tenant-scoping extension to read — tenantId must be passed explicitly in `where`.
    const { notificationId, tenantId } = job.data;
    try {
      if (job.data.channel === 'email' && this.getTransporter()) {
        await this.sendEmail(job.data);
      } else {
        this.logger.log(`[${job.data.channel}] would send to ${job.data.recipient}: "${job.data.body}"`);
      }
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

  private async sendEmail(data: NotificationJobData): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) return;
    await transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM', 'no-reply@ucms.app'),
      to: data.recipient,
      subject: data.subject ?? 'Notification',
      text: data.body,
    });
  }

  /** Lazily built and cached — `null` (never attempted) when SMTP isn't configured, so the stub path stays the default for a fresh checkout. */
  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return null;

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: this.config.get<string>('SMTP_USER') ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASSWORD') } : undefined,
    });
    return this.transporter;
  }
}
