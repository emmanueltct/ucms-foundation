import { Test } from '@nestjs/testing';
import { NotificationsProcessor } from '../src/queue/notifications.processor';
import { PrismaService } from '../src/prisma/prisma.service';

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;

  const mockPrisma = { notification: { update: jest.fn() } };

  const baseJob: any = {
    data: { notificationId: 'notif-1', tenantId: 'tenant-1', channel: 'email', recipient: 'x@x.test', body: 'hi' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [NotificationsProcessor, { provide: PrismaService, useValue: mockPrisma }],
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
});
