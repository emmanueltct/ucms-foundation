import { Test } from '@nestjs/testing';
import { ReportsService } from '../src/reports/reports.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    member: { count: jest.fn(), findMany: jest.fn() },
    staff: { count: jest.fn() },
    branch: { count: jest.fn() },
    event: { count: jest.fn() },
    contribution: { aggregate: jest.fn(), findMany: jest.fn() },
    attendanceRecord: { aggregate: jest.fn(), findMany: jest.fn() },
    payrollPayment: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(ReportsService);
  });

  describe('overview', () => {
    it('assembles KPI tiles from independent counts/aggregates', async () => {
      mockPrisma.member.count.mockResolvedValue(482);
      mockPrisma.staff.count.mockResolvedValue(12);
      mockPrisma.branch.count.mockResolvedValue(6);
      mockPrisma.event.count.mockResolvedValue(3);
      mockPrisma.contribution.aggregate.mockResolvedValue({ _sum: { amount: 1250000 } });
      mockPrisma.attendanceRecord.aggregate.mockResolvedValue({ _sum: { headcount: 2140 } });

      const result = await service.overview(TENANT_ID);

      expect(result).toEqual({
        members: 482,
        activeStaff: 12,
        branches: 6,
        upcomingEvents: 3,
        contributionsThisMonth: 1250000,
        attendanceLast30Days: 2140,
      });
    });

    it('defaults sums to 0 when there is no data yet', async () => {
      mockPrisma.member.count.mockResolvedValue(0);
      mockPrisma.staff.count.mockResolvedValue(0);
      mockPrisma.branch.count.mockResolvedValue(0);
      mockPrisma.event.count.mockResolvedValue(0);
      mockPrisma.contribution.aggregate.mockResolvedValue({ _sum: { amount: null } });
      mockPrisma.attendanceRecord.aggregate.mockResolvedValue({ _sum: { headcount: null } });

      const result = await service.overview(TENANT_ID);

      expect(result.contributionsThisMonth).toBe(0);
      expect(result.attendanceLast30Days).toBe(0);
    });
  });

  describe('financeSummary', () => {
    it('zero-fills every month in range and buckets totals by contribution type', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([
        { amount: 100000, contributionType: 'tithe', contributedAt: new Date('2026-06-05') },
        { amount: 50000, contributionType: 'offering', contributedAt: new Date('2026-06-20') },
        { amount: 200000, contributionType: 'tithe', contributedAt: new Date('2026-07-10') },
      ]);

      const result = await service.financeSummary(TENANT_ID, {
        dateFrom: '2026-05-01',
        dateTo: '2026-07-31',
      } as any);

      expect(result.byMonth).toEqual([
        { month: '2026-05', total: 0, count: 0 },
        { month: '2026-06', total: 150000, count: 2 },
        { month: '2026-07', total: 200000, count: 1 },
      ]);
      expect(result.byType).toEqual([
        { key: 'tithe', total: 300000, count: 2 },
        { key: 'offering', total: 50000, count: 1 },
      ]);
    });
  });

  describe('attendanceTrends', () => {
    it('sums headcount per month and per service type', async () => {
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([
        { headcount: 120, serviceType: 'sunday_service', attendedAt: new Date('2026-07-05') },
        { headcount: 40, serviceType: 'bible_study', attendedAt: new Date('2026-07-09') },
      ]);

      const result = await service.attendanceTrends(TENANT_ID, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
      } as any);

      expect(result.byMonth).toEqual([{ month: '2026-07', total: 160, count: 2 }]);
      expect(result.byServiceType).toEqual([
        { key: 'sunday_service', total: 120, count: 1 },
        { key: 'bible_study', total: 40, count: 1 },
      ]);
    });
  });

  describe('membershipGrowth', () => {
    it('computes a running cumulative count seeded from members created before the range', async () => {
      mockPrisma.member.findMany.mockResolvedValue([
        { createdAt: new Date('2026-06-10') },
        { createdAt: new Date('2026-07-02') },
        { createdAt: new Date('2026-07-15') },
      ]);
      mockPrisma.member.count.mockResolvedValue(470);

      const result = await service.membershipGrowth(TENANT_ID, {
        dateFrom: '2026-06-01',
        dateTo: '2026-07-31',
      } as any);

      expect(result.newMembersByMonth).toEqual([
        { month: '2026-06', total: 1, count: 1, cumulativeActive: 471 },
        { month: '2026-07', total: 2, count: 2, cumulativeActive: 473 },
      ]);
    });
  });

  describe('payrollSummary', () => {
    it('groups paid payments by month and by department, with an "unassigned" fallback for no department', async () => {
      mockPrisma.payrollPayment.findMany.mockResolvedValue([
        { netAmount: 400000, paidAt: new Date('2026-07-01'), staff: { department: 'pastoral' } },
        { netAmount: 250000, paidAt: new Date('2026-07-02'), staff: { department: null } },
      ]);

      const result = await service.payrollSummary(TENANT_ID, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
      } as any);

      expect(result.byMonth).toEqual([{ month: '2026-07', total: 650000, count: 2 }]);
      expect(result.byDepartment).toEqual([
        { key: 'pastoral', total: 400000, count: 1 },
        { key: 'unassigned', total: 250000, count: 1 },
      ]);
    });
  });
});
