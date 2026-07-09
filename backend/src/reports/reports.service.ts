import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemberActivitiesService } from '../members/member-activities.service';
import { ReportQueryDto } from './dto/report-query.dto';

export interface TimelineEntry {
  kind: 'ministry' | 'small_group' | 'event' | 'attendance' | 'contribution' | 'activity';
  date: string;
  label: string;
  detail?: string;
}

export interface MonthBucket {
  month: string;
  total: number;
  count: number;
}

export interface KeyBucket {
  key: string;
  total: number;
  count: number;
}

/**
 * Cross-cutting, read-only aggregation over data that already exists in
 * Finance, Attendance, Member, Event, and HR & Payroll — see
 * docs/reports/business-analysis.md for why this module introduces no new
 * Prisma models of its own. Month-bucketing is done in JS rather than a
 * database-level date_trunc groupBy so the whole codebase stays on plain
 * Prisma Client calls (no raw SQL) — fine at the data volumes a single
 * tenant produces, and easy to swap for a materialized view later if a
 * tenant's history ever outgrows it.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberActivitiesService: MemberActivitiesService,
  ) {}

  async overview(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [members, activeStaff, branches, upcomingEvents, contributionsThisMonth, attendanceLast30Days] =
      await Promise.all([
        this.prisma.member.count({ where: { tenantId, deletedAt: null, isActive: true } }),
        this.prisma.staff.count({ where: { tenantId, deletedAt: null, employmentStatus: 'active' } }),
        this.prisma.branch.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.event.count({ where: { tenantId, deletedAt: null, startsAt: { gte: now } } }),
        this.prisma.contribution.aggregate({
          where: { tenantId, isVoided: false, contributedAt: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
        this.prisma.attendanceRecord.aggregate({
          where: { tenantId, deletedAt: null, attendedAt: { gte: thirtyDaysAgo } },
          _sum: { headcount: true },
        }),
      ]);

    return {
      members,
      activeStaff,
      branches,
      upcomingEvents,
      contributionsThisMonth: contributionsThisMonth._sum.amount ?? 0,
      attendanceLast30Days: attendanceLast30Days._sum.headcount ?? 0,
    };
  }

  async financeSummary(tenantId: string, query: ReportQueryDto) {
    const { start, end } = this.resolveRange(query);
    const rows = await this.prisma.contribution.findMany({
      where: {
        tenantId,
        isVoided: false,
        contributedAt: { gte: start, lte: end },
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      select: { amount: true, contributionType: true, contributedAt: true },
    });

    return {
      byMonth: this.bucketByMonth(rows, start, end, (r) => r.contributedAt, (r) => Number(r.amount)),
      byType: this.bucketByKey(rows, (r) => r.contributionType, (r) => Number(r.amount)),
    };
  }

  async attendanceTrends(tenantId: string, query: ReportQueryDto) {
    const { start, end } = this.resolveRange(query);
    const rows = await this.prisma.attendanceRecord.findMany({
      where: {
        tenantId,
        deletedAt: null,
        attendedAt: { gte: start, lte: end },
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      select: { headcount: true, serviceType: true, attendedAt: true },
    });

    return {
      byMonth: this.bucketByMonth(rows, start, end, (r) => r.attendedAt, (r) => r.headcount),
      byServiceType: this.bucketByKey(rows, (r) => r.serviceType, (r) => r.headcount),
    };
  }

  async membershipGrowth(tenantId: string, query: ReportQueryDto) {
    const { start, end } = this.resolveRange(query);
    const [newMembers, activeBeforeStart] = await Promise.all([
      this.prisma.member.findMany({
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
          ...(query.branchId ? { branchId: query.branchId } : {}),
        },
        select: { createdAt: true },
      }),
      this.prisma.member.count({
        where: {
          tenantId,
          createdAt: { lt: start },
          deletedAt: null,
          ...(query.branchId ? { branchId: query.branchId } : {}),
        },
      }),
    ]);

    const byMonth = this.bucketByMonth(newMembers, start, end, (r) => r.createdAt, () => 1);
    let cumulative = activeBeforeStart;
    const newMembersByMonth = byMonth.map((bucket) => {
      cumulative += bucket.total;
      return { ...bucket, cumulativeActive: cumulative };
    });

    return { newMembersByMonth };
  }

  async payrollSummary(tenantId: string, query: ReportQueryDto) {
    const { start, end } = this.resolveRange(query);
    const rows = await this.prisma.payrollPayment.findMany({
      where: { tenantId, status: 'paid', paidAt: { gte: start, lte: end } },
      select: { netAmount: true, paidAt: true, staff: { select: { department: true } } },
    });

    return {
      byMonth: this.bucketByMonth(rows, start, end, (r) => r.paidAt as Date, (r) => Number(r.netAmount)),
      byDepartment: this.bucketByKey(rows, (r) => r.staff.department ?? 'unassigned', (r) => Number(r.netAmount)),
    };
  }

  /**
   * A member's whole personal history in one place — ministries served,
   * small groups/programs attended, events attended, attendance and giving
   * summaries, and every logged MemberActivity (sacraments, trainings,
   * certificates, leadership appointments, ...), merged into one
   * chronological `timeline`. See docs/member-activities/business-analysis.md
   * for why this composes five modules' existing data plus one new model
   * rather than introducing a single denormalized "activity" table for
   * everything (ministries/small groups/events/attendance/giving already
   * have their own, richer, dedicated tracking).
   */
  async memberActivityHistory(tenantId: string, memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, tenantId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, membershipNumber: true },
    });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });

    const [ministries, smallGroups, eventRegistrations, attendanceRecords, contributions, activities] =
      await Promise.all([
        this.prisma.ministryMembership.findMany({
          where: { tenantId, memberId },
          include: { ministry: { select: { name: true } } },
          orderBy: { joinedAt: 'desc' },
        }),
        this.prisma.smallGroupMembership.findMany({
          where: { tenantId, memberId },
          include: { smallGroup: { select: { name: true } } },
          orderBy: { joinedAt: 'desc' },
        }),
        this.prisma.eventRegistration.findMany({
          where: { tenantId, memberId },
          include: { event: { select: { name: true, startsAt: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.attendanceRecord.findMany({
          where: { tenantId, memberId, deletedAt: null },
          select: { serviceType: true, attendedAt: true, headcount: true },
          orderBy: { attendedAt: 'desc' },
          take: 50,
        }),
        this.prisma.contribution.findMany({
          where: { tenantId, memberId, isVoided: false },
          select: { contributionType: true, amount: true, currency: true, contributedAt: true },
          orderBy: { contributedAt: 'desc' },
          take: 50,
        }),
        this.memberActivitiesService.listActivitiesRaw(tenantId, memberId),
      ]);

    const attendanceTotal = await this.prisma.attendanceRecord.aggregate({
      where: { tenantId, memberId, deletedAt: null },
      _count: { _all: true },
    });
    const contributionsTotal = await this.prisma.contribution.aggregate({
      where: { tenantId, memberId, isVoided: false },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const timeline: TimelineEntry[] = [
      ...ministries.map((m) => ({
        kind: 'ministry' as const,
        date: (m.joinedAt ?? m.createdAt).toISOString(),
        label: `Joined ${m.ministry.name}`,
        detail: m.role,
      })),
      ...smallGroups.map((g) => ({
        kind: 'small_group' as const,
        date: (g.joinedAt ?? g.createdAt).toISOString(),
        label: `Joined ${g.smallGroup.name}`,
        detail: g.role,
      })),
      ...eventRegistrations.map((r) => ({
        kind: 'event' as const,
        date: r.event.startsAt.toISOString(),
        label: r.event.name,
        detail: r.status,
      })),
      ...attendanceRecords.map((a) => ({
        kind: 'attendance' as const,
        date: a.attendedAt.toISOString(),
        label: `Attended ${a.serviceType}`,
      })),
      ...contributions.map((c) => ({
        kind: 'contribution' as const,
        date: c.contributedAt.toISOString(),
        label: `Gave (${c.contributionType})`,
        detail: `${c.amount} ${c.currency}`,
      })),
      ...activities.map((a) => ({
        kind: 'activity' as const,
        date: a.activityDate.toISOString(),
        label: a.activityType,
        detail: a.outcome ?? undefined,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return {
      member,
      ministries,
      smallGroups,
      eventsAttended: eventRegistrations,
      attendance: { totalCount: attendanceTotal._count._all, recent: attendanceRecords },
      contributions: {
        totalAmount: contributionsTotal._sum.amount ?? 0,
        totalCount: contributionsTotal._count._all,
        recent: contributions,
      },
      activities,
      timeline,
    };
  }

  private resolveRange(query: ReportQueryDto): { start: Date; end: Date } {
    const end = query.dateTo ? new Date(query.dateTo) : new Date();
    const start = query.dateFrom ? new Date(query.dateFrom) : new Date(end.getFullYear(), end.getMonth() - 11, 1);
    return { start, end };
  }

  /** Zero-fills every month in [start, end] so a line/bar chart never has a gap for a quiet month. */
  private bucketByMonth<T>(
    rows: T[],
    start: Date,
    end: Date,
    getDate: (row: T) => Date,
    getValue: (row: T) => number,
  ): MonthBucket[] {
    const buckets = new Map<string, MonthBucket>();
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      const key = this.monthKey(cursor);
      buckets.set(key, { month: key, total: 0, count: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    for (const row of rows) {
      const key = this.monthKey(getDate(row));
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.total += getValue(row);
        bucket.count += 1;
      }
    }

    return Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month));
  }

  private bucketByKey<T>(rows: T[], getKey: (row: T) => string, getValue: (row: T) => number): KeyBucket[] {
    const buckets = new Map<string, KeyBucket>();
    for (const row of rows) {
      const key = getKey(row);
      const bucket = buckets.get(key) ?? { key, total: 0, count: 0 };
      bucket.total += getValue(row);
      bucket.count += 1;
      buckets.set(key, bucket);
    }
    return Array.from(buckets.values()).sort((a, b) => b.total - a.total);
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}
