import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LeadershipAppointmentsService } from '../src/leadership-appointments/leadership-appointments.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('LeadershipAppointmentsService', () => {
  let service: LeadershipAppointmentsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    leadershipAppointment: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [LeadershipAppointmentsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(LeadershipAppointmentsService);
  });

  describe('create', () => {
    it('throws ConflictException when this user already holds an appointment over this target', async () => {
      mockPrisma.leadershipAppointment.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create(TENANT_ID, { targetEntityType: 'branch', targetEntityId: 'branch-1', userId: 'user-1' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.leadershipAppointment.create).not.toHaveBeenCalled();
    });

    it('creates the appointment when none exists yet', async () => {
      mockPrisma.leadershipAppointment.findUnique.mockResolvedValue(null);
      mockPrisma.leadershipAppointment.create.mockResolvedValue({ id: 'appt-1' });

      const result = await service.create(TENANT_ID, { targetEntityType: 'branch', targetEntityId: 'branch-1', userId: 'user-1' });

      expect(mockPrisma.leadershipAppointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tenantId: TENANT_ID, targetEntityType: 'branch', targetEntityId: 'branch-1', userId: 'user-1' },
        }),
      );
      expect(result).toEqual({ id: 'appt-1' });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the appointment does not exist in this tenant', async () => {
      mockPrisma.leadershipAppointment.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_ID, 'appt-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.leadershipAppointment.delete).not.toHaveBeenCalled();
    });

    it('deletes the appointment when it exists', async () => {
      mockPrisma.leadershipAppointment.findFirst.mockResolvedValue({ id: 'appt-1' });

      const result = await service.remove(TENANT_ID, 'appt-1');

      expect(mockPrisma.leadershipAppointment.delete).toHaveBeenCalledWith({ where: { id: 'appt-1' } });
      expect(result).toEqual({ id: 'appt-1' });
    });
  });

  describe('findForTarget / findMine', () => {
    it('findForTarget filters by tenant + target', async () => {
      mockPrisma.leadershipAppointment.findMany.mockResolvedValue([{ id: 'appt-1' }]);

      await service.findForTarget(TENANT_ID, 'branch', 'branch-1');

      expect(mockPrisma.leadershipAppointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, targetEntityType: 'branch', targetEntityId: 'branch-1' } }),
      );
    });

    it('findMine filters by tenant + userId', async () => {
      mockPrisma.leadershipAppointment.findMany.mockResolvedValue([{ id: 'appt-1' }]);

      await service.findMine(TENANT_ID, 'user-1');

      expect(mockPrisma.leadershipAppointment.findMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, userId: 'user-1' } });
    });
  });
});
