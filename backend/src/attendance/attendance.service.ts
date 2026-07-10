import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceRecord, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { resolveBranchFilter } from '../common/branch-scope/branch-visibility.util';

/**
 * Attendance recording — see docs/attendance/business-analysis.md. An
 * individual check-in (`memberId` set) always counts as 1; an anonymous
 * head-count entry (`memberId` omitted) carries its own `headcount`. Records
 * are corrected in place or soft-deleted, unlike Finance's stricter
 * void-only pattern — a mis-typed head-count carries no audit-trail concern.
 */
@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    recordedByUserId: string | undefined,
    dto: CreateAttendanceRecordDto,
  ): Promise<AttendanceRecord> {
    await this.assertBranchExists(tenantId, dto.branchId);
    if (dto.memberId) {
      await this.assertMemberExists(tenantId, dto.memberId);
    }

    const headcount = this.resolveHeadcount(dto.memberId, dto.headcount);
    const attendedAt = new Date(dto.attendedAt);

    await this.assertNotAlreadyRecorded(tenantId, dto.branchId, dto.memberId, dto.serviceType, attendedAt);

    return this.prisma.attendanceRecord.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        memberId: dto.memberId ?? null,
        serviceType: dto.serviceType,
        attendanceMethod: dto.attendanceMethod,
        headcount,
        attendedAt,
        recordedByUserId,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: AttendanceQueryDto, visibleBranchIds: string[] | null = null) {
    const where = this.buildWhere(tenantId, query, visibleBranchIds);

    const [items, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { attendedAt: 'desc' },
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<AttendanceRecord> {
    const record = await this.prisma.attendanceRecord.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!record) {
      throw new NotFoundException({ code: 'ATTENDANCE_RECORD_NOT_FOUND', message: 'Attendance record not found.' });
    }
    return record;
  }

  async update(tenantId: string, id: string, dto: UpdateAttendanceRecordDto): Promise<AttendanceRecord> {
    const existing = await this.findOne(tenantId, id);

    const branchId = dto.branchId ?? existing.branchId;
    if (dto.branchId && dto.branchId !== existing.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }

    const memberId = dto.memberId !== undefined ? dto.memberId : existing.memberId;
    if (dto.memberId) {
      await this.assertMemberExists(tenantId, dto.memberId);
    }

    const serviceType = dto.serviceType ?? existing.serviceType;
    const attendedAt = dto.attendedAt ? new Date(dto.attendedAt) : existing.attendedAt;
    const compositeKeyChanged =
      branchId !== existing.branchId ||
      memberId !== existing.memberId ||
      serviceType !== existing.serviceType ||
      attendedAt.getTime() !== existing.attendedAt.getTime();

    if (compositeKeyChanged) {
      await this.assertNotAlreadyRecorded(tenantId, branchId, memberId ?? undefined, serviceType, attendedAt, id);
    }

    const headcount =
      dto.headcount !== undefined || dto.memberId !== undefined
        ? this.resolveHeadcount(memberId ?? undefined, dto.headcount ?? existing.headcount)
        : undefined;

    return this.prisma.attendanceRecord.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        memberId: dto.memberId,
        serviceType: dto.serviceType,
        attendanceMethod: dto.attendanceMethod,
        headcount,
        attendedAt: dto.attendedAt ? attendedAt : undefined,
        notes: dto.notes,
      },
    });
  }

  /** Totals grouped by service type, for the same filters as findAll. */
  async summary(tenantId: string, query: AttendanceQueryDto, visibleBranchIds: string[] | null = null) {
    const where = this.buildWhere(tenantId, query, visibleBranchIds);

    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['serviceType'],
      where,
      _sum: { headcount: true },
      _count: { _all: true },
      orderBy: { serviceType: 'asc' },
    });

    return grouped.map((g) => ({
      serviceType: g.serviceType,
      totalAttendance: g._sum.headcount ?? 0,
      recordCount: g._count._all,
    }));
  }

  async softDelete(tenantId: string, id: string): Promise<AttendanceRecord> {
    await this.findOne(tenantId, id);
    return this.prisma.attendanceRecord.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** memberId set => individual check-in, always counts as 1; memberId absent => a required, positive head-count. */
  private resolveHeadcount(memberId: string | null | undefined, headcount: number | undefined): number {
    if (memberId) return 1;
    if (!headcount || headcount <= 0) {
      throw new BadRequestException({
        code: 'ATTENDANCE_HEADCOUNT_REQUIRED',
        message: 'A positive headcount is required for an anonymous attendance entry.',
      });
    }
    return headcount;
  }

  private buildWhere(tenantId: string, query: AttendanceQueryDto, visibleBranchIds: string[] | null = null): Prisma.AttendanceRecordWhereInput {
    return {
      tenantId,
      deletedAt: null,
      ...resolveBranchFilter(query.branchId, visibleBranchIds),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.serviceType ? { serviceType: query.serviceType } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            attendedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };
  }

  private async assertBranchExists(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
  }

  private async assertMemberExists(tenantId: string, memberId: string): Promise<void> {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId, deletedAt: null } });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
  }

  private async assertNotAlreadyRecorded(
    tenantId: string,
    branchId: string,
    memberId: string | null | undefined,
    serviceType: string,
    attendedAt: Date,
    excludeId?: string,
  ): Promise<void> {
    if (!memberId) return; // uniqueness only makes sense for named individuals; bulk head-counts may repeat
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: { tenantId, branchId, memberId, serviceType, attendedAt, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ATTENDANCE_ALREADY_RECORDED',
        message: 'This member already has an attendance record for this service and date.',
      });
    }
  }
}
