import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from '../src/reports/reports.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MemberActivitiesService } from '../src/members/member-activities.service';

describe('ReportsService', () => {
  let service: ReportsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    member: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    staff: { count: jest.fn() },
    branch: { count: jest.fn() },
    event: { count: jest.fn() },
    contribution: { aggregate: jest.fn(), findMany: jest.fn() },
    attendanceRecord: { aggregate: jest.fn(), findMany: jest.fn() },
    payrollPayment: { findMany: jest.fn() },
    ministryMembership: { findMany: jest.fn() },
    smallGroupMembership: { findMany: jest.fn() },
    eventRegistration: { findMany: jest.fn() },
    dynamicModuleRecord: { findMany: jest.fn() },
    dynamicModuleRecordStatusHistory: { findMany: jest.fn() },
  };

  const mockMemberActivitiesService = {
    listActivitiesRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMemberActivitiesService.listActivitiesRaw.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MemberActivitiesService, useValue: mockMemberActivitiesService },
      ],
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

  describe('memberActivityHistory', () => {
    it('rejects when the member does not exist', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);

      await expect(service.memberActivityHistory(TENANT_ID, 'member-1')).rejects.toThrow(NotFoundException);
    });

    it('merges ministries, small groups, events, attendance, contributions, and activities into one sorted timeline', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1', firstName: 'Alice', lastName: 'Uwase', membershipNumber: 'M-001' });
      mockPrisma.ministryMembership.findMany.mockResolvedValue([
        { ministryId: 'min-1', role: 'leader', joinedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), ministry: { name: 'Choir' } },
      ]);
      mockPrisma.smallGroupMembership.findMany.mockResolvedValue([
        { smallGroupId: 'sg-1', role: 'member', joinedAt: new Date('2026-02-01'), createdAt: new Date('2026-02-01'), smallGroup: { name: 'Youth Cell' } },
      ]);
      mockPrisma.eventRegistration.findMany.mockResolvedValue([
        { eventId: 'ev-1', status: 'attended', createdAt: new Date('2026-03-01'), event: { name: 'Annual Conference', startsAt: new Date('2026-03-05') } },
      ]);
      const recentAttendance = [{ serviceType: 'sunday_service', attendedAt: new Date('2026-07-05'), headcount: 1 }];
      mockPrisma.attendanceRecord.findMany.mockResolvedValue(recentAttendance);
      mockPrisma.attendanceRecord.aggregate.mockResolvedValue({ _count: { _all: 40 } });
      mockPrisma.contribution.findMany.mockResolvedValue([
        { contributionType: 'tithe', amount: 10000, currency: 'RWF', contributedAt: new Date('2026-07-01') },
      ]);
      mockPrisma.contribution.aggregate.mockResolvedValue({ _sum: { amount: 500000 }, _count: { _all: 12 } });
      mockMemberActivitiesService.listActivitiesRaw.mockResolvedValue([
        { id: 'act-1', activityType: 'baptism', activityDate: new Date('2026-04-01'), outcome: null, customFields: {} },
      ]);

      const result = await service.memberActivityHistory(TENANT_ID, 'member-1');

      expect(result.member).toEqual({ id: 'member-1', firstName: 'Alice', lastName: 'Uwase', membershipNumber: 'M-001' });
      expect(result.attendance).toEqual({ totalCount: 40, recent: recentAttendance });
      expect(result.contributions.totalAmount).toBe(500000);
      expect(result.contributions.totalCount).toBe(12);
      // most recent first: attendance (07-05) > contribution (07-01) > activity (04-01) > event (03-05) > small group (02-01) > ministry (01-01)
      expect(result.timeline.map((t) => t.kind)).toEqual([
        'attendance',
        'contribution',
        'activity',
        'event',
        'small_group',
        'ministry',
      ]);
    });
  });

  describe('exportFinanceSummary', () => {
    it('reuses financeSummary and shapes byMonth/byType into export tables', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([
        { amount: 100000, contributionType: 'tithe', contributedAt: new Date('2026-07-05') },
      ]);

      const tables = await service.exportFinanceSummary(TENANT_ID, { dateFrom: '2026-07-01', dateTo: '2026-07-31' } as any);

      expect(tables).toHaveLength(2);
      expect(tables[0]).toEqual({
        title: 'Giving by month',
        columns: [
          { key: 'month', header: 'Month' },
          { key: 'total', header: 'Total' },
          { key: 'count', header: 'Count' },
        ],
        rows: [{ month: '2026-07', total: 100000, count: 1 }],
      });
      expect(tables[1].title).toBe('Giving by contribution type');
      expect(tables[1].rows).toEqual([{ key: 'tithe', total: 100000, count: 1 }]);
    });
  });

  describe('formSubmissionsSummary', () => {
    it('buckets submissions of one form by month and by status, and applies every optional filter', async () => {
      mockPrisma.dynamicModuleRecord.findMany.mockResolvedValue([
        { status: 'submitted', createdAt: new Date('2026-07-05') },
        { status: 'approved', createdAt: new Date('2026-07-10') },
        { status: 'submitted', createdAt: new Date('2026-07-12') },
      ]);

      const result = await service.formSubmissionsSummary(TENANT_ID, {
        moduleDefinitionId: 'form-1',
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
        branchId: 'branch-1',
        attachedToEntityType: 'dynamic_module_record',
        attachedToEntityId: 'dept-1',
        createdByUserId: 'user-1',
      } as any);

      expect(mockPrisma.dynamicModuleRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            moduleDefinitionId: 'form-1',
            deletedAt: null,
            branchId: 'branch-1',
            attachedToEntityType: 'dynamic_module_record',
            attachedToEntityId: 'dept-1',
            createdByUserId: 'user-1',
          }),
        }),
      );
      expect(result.totalSubmissions).toBe(3);
      expect(result.byMonth).toEqual([{ month: '2026-07', total: 3, count: 3 }]);
      expect(result.byStatus).toEqual([
        { key: 'submitted', total: 2, count: 2 },
        { key: 'approved', total: 1, count: 1 },
      ]);
    });
  });

  describe('exportFormSubmissionsSummary', () => {
    it('reuses formSubmissionsSummary and shapes byMonth/byStatus into export tables', async () => {
      mockPrisma.dynamicModuleRecord.findMany.mockResolvedValue([
        { status: 'submitted', createdAt: new Date('2026-07-05') },
      ]);

      const tables = await service.exportFormSubmissionsSummary(TENANT_ID, {
        moduleDefinitionId: 'form-1',
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
      } as any);

      expect(tables).toHaveLength(2);
      expect(tables[0].title).toBe('Submissions by month');
      expect(tables[1].title).toBe('Submissions by status');
      expect(tables[1].rows).toEqual([{ key: 'submitted', total: 1, count: 1 }]);
    });
  });

  describe('statusHistory', () => {
    it('applies every optional filter and orders newest first', async () => {
      const rows = [{ id: 'hist-1', toStatus: 'approved', record: { id: 'rec-1', title: 'Audit', moduleDefinitionId: 'form-1' } }];
      mockPrisma.dynamicModuleRecordStatusHistory.findMany.mockResolvedValue(rows);

      const result = await service.statusHistory(TENANT_ID, {
        moduleDefinitionId: 'form-1',
        recordId: 'rec-1',
        changedByUserId: 'user-1',
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
      });

      expect(mockPrisma.dynamicModuleRecordStatusHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            recordId: 'rec-1',
            changedByUserId: 'user-1',
            record: { moduleDefinitionId: 'form-1' },
            createdAt: { gte: new Date('2026-07-01'), lte: new Date('2026-07-31') },
          }),
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual(rows);
    });

    it('omits filters that were not provided', async () => {
      mockPrisma.dynamicModuleRecordStatusHistory.findMany.mockResolvedValue([]);

      await service.statusHistory(TENANT_ID, {});

      expect(mockPrisma.dynamicModuleRecordStatusHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID } }),
      );
    });
  });
});
