import { Test } from '@nestjs/testing';
import { LeadershipScopeService } from '../src/common/leadership-scope/leadership-scope.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('LeadershipScopeService', () => {
  let service: LeadershipScopeService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    leadershipAppointment: { findFirst: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [LeadershipScopeService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(LeadershipScopeService);
  });

  describe('isLeaderOf', () => {
    it('returns true when a matching appointment exists', async () => {
      mockPrisma.leadershipAppointment.findFirst.mockResolvedValue({ id: 'appt-1' });

      const result = await service.isLeaderOf(TENANT_ID, 'user-1', 'branch', 'branch-1');

      expect(mockPrisma.leadershipAppointment.findFirst).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, userId: 'user-1', targetEntityType: 'branch', targetEntityId: 'branch-1' },
      });
      expect(result).toBe(true);
    });

    it('returns false when no appointment matches', async () => {
      mockPrisma.leadershipAppointment.findFirst.mockResolvedValue(null);

      const result = await service.isLeaderOf(TENANT_ID, 'user-1', 'branch', 'branch-1');

      expect(result).toBe(false);
    });
  });

  describe('resolveAppointmentsFor', () => {
    it('returns every appointment the user holds', async () => {
      mockPrisma.leadershipAppointment.findMany.mockResolvedValue([{ id: 'appt-1' }, { id: 'appt-2' }]);

      const result = await service.resolveAppointmentsFor(TENANT_ID, 'user-1');

      expect(mockPrisma.leadershipAppointment.findMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, userId: 'user-1' } });
      expect(result).toHaveLength(2);
    });
  });
});
