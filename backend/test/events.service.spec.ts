import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventsService } from '../src/events/events.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('EventsService', () => {
  let service: EventsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    event: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
    eventRegistration: { updateMany: jest.fn() },
    branch: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(EventsService);
  });

  describe('create', () => {
    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, { name: 'Youth Camp', branchId: 'missing', startsAt: '2026-08-15T09:00:00.000Z' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a church-wide event when branchId is omitted', async () => {
      mockPrisma.event.create.mockResolvedValue({ id: 'evt-1', branchId: null });

      await service.create(TENANT_ID, { name: 'Conference', startsAt: '2026-08-15T09:00:00.000Z' } as any);

      expect(mockPrisma.branch.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ branchId: null }) }),
      );
    });
  });

  describe('softDelete', () => {
    it('deactivates the event and cancels every non-cancelled registration', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'evt-1' });
      mockPrisma.eventRegistration.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.event.update.mockResolvedValue({ id: 'evt-1', isActive: false });

      await service.softDelete(TENANT_ID, 'evt-1');

      expect(mockPrisma.eventRegistration.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, eventId: 'evt-1', status: { not: 'cancelled' } },
        data: { status: 'cancelled' },
      });
      expect(mockPrisma.event.update).toHaveBeenCalledWith({
        where: { id: 'evt-1' },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });
  });

  describe('findAll', () => {
    it('filters by date range on startsAt', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {
        page: 1,
        pageSize: 20,
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      } as any);

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ startsAt: { gte: new Date('2026-08-01'), lte: new Date('2026-08-31') } }),
        }),
      );
    });
  });
});
