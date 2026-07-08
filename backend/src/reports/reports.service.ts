import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

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
  constructor(private readonly prisma: PrismaService) {}

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
