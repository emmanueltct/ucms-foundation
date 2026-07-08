import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventRegistrationsService } from '../src/events/event-registrations.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('EventRegistrationsService', () => {
  let service: EventRegistrationsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    eventRegistration: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
    event: { findFirst: jest.fn() },
    member: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [EventRegistrationsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(EventRegistrationsService);
  });

  describe('create', () => {
    it('rejects when eventId does not resolve within the tenant', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, { eventId: 'missing', memberId: 'member-1' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when memberId does not resolve within the tenant', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'evt-1', capacity: null });
      mockPrisma.member.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, { eventId: 'evt-1', memberId: 'missing' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when neither memberId nor guestName is provided', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'evt-1', capacity: null });

      await expect(service.create(TENANT_ID, { eventId: 'evt-1' } as any)).rejects.toThrow(BadRequestException);
    });

    it('rejects a duplicate registration for the same member/event', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'evt-1', capacity: null });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.eventRegistration.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create(TENANT_ID, { eventId: 'evt-1', memberId: 'member-1' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('accepts a guest registration with no memberId', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'evt-1', capacity: null });
      mockPrisma.eventRegistration.create.mockResolvedValue({ id: 'reg-1' });

      await service.create(TENANT_ID, { eventId: 'evt-1', guestName: 'Alice Uwase' } as any);

      expect(mockPrisma.member.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.eventRegistration.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ memberId: null, guestName: 'Alice Uwase' }) }),
      );
    });

    it('rejects a new registration once the event is at capacity', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'evt-1', capacity: 2 });
      mockPrisma.eventRegistration.count.mockResolvedValue(2);

      await expect(
        service.create(TENANT_ID, { eventId: 'evt-1', guestName: 'Walk-in' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('allows registration when under capacity', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'evt-1', capacity: 200 });
      mockPrisma.eventRegistration.count.mockResolvedValue(199);
      mockPrisma.eventRegistration.create.mockResolvedValue({ id: 'reg-1' });

      await service.create(TENANT_ID, { eventId: 'evt-1', guestName: 'Walk-in' } as any);

      expect(mockPrisma.eventRegistration.create).toHaveBeenCalled();
    });

    it('does not check capacity at all when the event has none set', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'evt-1', capacity: null });
      mockPrisma.eventRegistration.create.mockResolvedValue({ id: 'reg-1' });

      await service.create(TENANT_ID, { eventId: 'evt-1', guestName: 'Walk-in' } as any);

      expect(mockPrisma.eventRegistration.count).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('sets status to cancelled rather than deleting the row', async () => {
      mockPrisma.eventRegistration.findFirst.mockResolvedValue({ id: 'reg-1' });
      mockPrisma.eventRegistration.update.mockResolvedValue({ id: 'reg-1', status: 'cancelled' });

      await service.cancel(TENANT_ID, 'reg-1');

      expect(mockPrisma.eventRegistration.update).toHaveBeenCalledWith({
        where: { id: 'reg-1' },
        data: { status: 'cancelled' },
      });
    });
  });
});
