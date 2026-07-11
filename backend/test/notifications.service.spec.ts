import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../src/communication/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { NotificationTemplatesService } from '../src/notification-templates/notification-templates.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const TENANT_ID = 'tenant-1';
  const USER_ID = 'user-1';

  const mockPrisma = {
    notification: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    member: { findFirst: jest.fn() },
  };
  const mockQueue = { enqueueNotification: jest.fn() };
  const mockTemplates = { findByKey: jest.fn(), render: jest.fn((text: string) => text) };

  beforeEach(async () => {
    jest.clearAllMocks();
    // No templateKey resolves by default — existing tests' ad-hoc subject/body pass through unchanged.
    mockTemplates.findByKey.mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueue },
        { provide: NotificationTemplatesService, useValue: mockTemplates },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  describe('recipient resolution', () => {
    it('uses an explicit recipient even when memberId is also provided', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1', recipient: 'explicit@x.test' });

      await service.create(TENANT_ID, USER_ID, {
        channel: 'email',
        memberId: 'member-1',
        recipient: 'explicit@x.test',
        body: 'hi',
      } as any);

      expect(mockPrisma.member.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ recipient: 'explicit@x.test' }) }),
      );
    });

    it('rejects push notifications with no explicit recipient', async () => {
      await expect(service.create(TENANT_ID, USER_ID, { channel: 'push', body: 'hi' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when neither recipient nor memberId is given for email/sms', async () => {
      await expect(service.create(TENANT_ID, USER_ID, { channel: 'email', body: 'hi' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when memberId does not resolve within the tenant', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await expect(
        service.create(TENANT_ID, USER_ID, { channel: 'email', memberId: 'missing', body: 'hi' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the resolved member has no email on file for the email channel', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1', email: null, phone: '+250780000000' });
      await expect(
        service.create(TENANT_ID, USER_ID, { channel: 'email', memberId: 'member-1', body: 'hi' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('resolves the recipient from Member.email for the email channel', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1', email: 'jean@x.test', phone: null });
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });

      await service.create(TENANT_ID, USER_ID, { channel: 'email', memberId: 'member-1', body: 'hi' } as any);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ recipient: 'jean@x.test' }) }),
      );
    });

    it('resolves the recipient from Member.phone for the sms channel', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1', email: null, phone: '+250780000000' });
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });

      await service.create(TENANT_ID, USER_ID, { channel: 'sms', memberId: 'member-1', body: 'hi' } as any);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ recipient: '+250780000000' }) }),
      );
    });
  });

  describe('create', () => {
    it('enqueues a job referencing the created notification id, after persisting it as queued', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1', status: 'queued' });

      await service.create(TENANT_ID, USER_ID, { channel: 'email', recipient: 'x@x.test', body: 'hi' } as any);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'queued', createdByUserId: USER_ID }) }),
      );
      expect(mockQueue.enqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({ notificationId: 'notif-1', tenantId: TENANT_ID, recipient: 'x@x.test' }),
      );
    });
  });

  describe('findAll', () => {
    it('filters by channel/status/memberId when provided', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { page: 1, pageSize: 20, channel: 'sms', status: 'sent', memberId: 'member-1' } as any);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ channel: 'sms', status: 'sent', recipientMemberId: 'member-1' }),
        }),
      );
    });
  });
});
