import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NotificationsProcessor } from '../src/queue/notifications.processor';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('nodemailer');

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;

  const mockPrisma = { notification: { update: jest.fn() } };
  const mockSendMail = jest.fn();
  const mockConfig = { get: jest.fn() };

  const baseJob: any = {
    data: { notificationId: 'notif-1', tenantId: 'tenant-1', channel: 'email', recipient: 'x@x.test', body: 'hi', subject: 'Hello' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: mockSendMail });
    mockConfig.get.mockImplementation((key: string, fallback?: unknown) => fallback);
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    processor = moduleRef.get(NotificationsProcessor);
  });

  it('marks the notification sent, scoping the update explicitly by tenantId (no request context exists here)', async () => {
    mockPrisma.notification.update.mockResolvedValue({ id: 'notif-1', status: 'sent' });

    await processor.process(baseJob);

    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1', tenantId: 'tenant-1' },
      data: { status: 'sent', sentAt: expect.any(Date) },
    });
  });

  it('falls back to the log-only stub (never calls nodemailer) when SMTP_HOST is not configured', async () => {
    mockPrisma.notification.update.mockResolvedValue({ id: 'notif-1', status: 'sent' });

    await processor.process(baseJob);

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('marks the notification failed and re-throws when the update itself fails', async () => {
    mockPrisma.notification.update
      .mockRejectedValueOnce(new Error('boom')) // the "sent" update fails
      .mockResolvedValueOnce({ id: 'notif-1', status: 'failed' }); // the "failed" update succeeds

    await expect(processor.process(baseJob)).rejects.toThrow('boom');

    expect(mockPrisma.notification.update).toHaveBeenLastCalledWith({
      where: { id: 'notif-1', tenantId: 'tenant-1' },
      data: { status: 'failed', errorMessage: 'boom' },
    });
  });

  describe('when SMTP is configured', () => {
    beforeEach(() => {
      mockConfig.get.mockImplementation((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = { SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'no-reply@church.test' };
        return key in values ? values[key] : fallback;
      });
    });

    it('sends a real email via nodemailer for an email-channel job, then marks it sent', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-1' });
      mockPrisma.notification.update.mockResolvedValue({ id: 'notif-1', status: 'sent' });

      await processor.process(baseJob);

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.example.com' }),
      );
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'no-reply@church.test',
        to: 'x@x.test',
        subject: 'Hello',
        text: 'hi',
      });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1', tenantId: 'tenant-1' },
        data: { status: 'sent', sentAt: expect.any(Date) },
      });
    });

    it('still uses the log-only stub for a non-email channel even when SMTP is configured', async () => {
      mockPrisma.notification.update.mockResolvedValue({ id: 'notif-1', status: 'sent' });

      await processor.process({ ...baseJob, data: { ...baseJob.data, channel: 'sms' } });

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('marks the notification failed when the SMTP send itself throws', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));
      mockPrisma.notification.update.mockResolvedValue({ id: 'notif-1', status: 'failed' });

      await expect(processor.process(baseJob)).rejects.toThrow('SMTP connection refused');

      expect(mockPrisma.notification.update).toHaveBeenLastCalledWith({
        where: { id: 'notif-1', tenantId: 'tenant-1' },
        data: { status: 'failed', errorMessage: 'SMTP connection refused' },
      });
    });

    it('builds the transporter only once across multiple jobs', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-1' });
      mockPrisma.notification.update.mockResolvedValue({ id: 'notif-1', status: 'sent' });

      await processor.process(baseJob);
      await processor.process(baseJob);

      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });
  });
});
