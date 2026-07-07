import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from '../src/attendance/attendance.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AttendanceService', () => {
  let service: AttendanceService;

  const TENANT_ID = 'tenant-1';
  const USER_ID = 'user-1';

  const mockPrisma = {
    attendanceRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    branch: { findFirst: jest.fn() },
    member: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [AttendanceService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(AttendanceService);
  });

  describe('create', () => {
    const baseDto = { branchId: 'branch-1', serviceType: 'sunday_service', attendedAt: '2026-07-05' };

    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      await expect(service.create(TENANT_ID, USER_ID, { ...baseDto, headcount: 100 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects when memberId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await expect(
        service.create(TENANT_ID, USER_ID, { ...baseDto, memberId: 'missing' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('forces headcount to 1 when memberId is set, ignoring any supplied value', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.attendanceRecord.findFirst.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue({ id: 'att-1' });

      await service.create(TENANT_ID, USER_ID, { ...baseDto, memberId: 'member-1', headcount: 50 } as any);

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ memberId: 'member-1', headcount: 1 }) }),
      );
    });

    it('rejects an anonymous entry with no headcount', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      await expect(service.create(TENANT_ID, USER_ID, baseDto as any)).rejects.toThrow(BadRequestException);
    });

    it('rejects an anonymous entry with a zero/negative headcount', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      await expect(service.create(TENANT_ID, USER_ID, { ...baseDto, headcount: 0 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts an anonymous entry with a positive headcount', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.attendanceRecord.create.mockResolvedValue({ id: 'att-1' });

      await service.create(TENANT_ID, USER_ID, { ...baseDto, headcount: 214 } as any);

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ memberId: null, headcount: 214 }) }),
      );
      // Anonymous entries skip the duplicate-check query entirely.
      expect(mockPrisma.attendanceRecord.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a duplicate individual check-in for the same branch/service/date', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.attendanceRecord.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create(TENANT_ID, USER_ID, { ...baseDto, memberId: 'member-1' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    const existingRecord = {
      id: 'att-1',
      tenantId: TENANT_ID,
      branchId: 'branch-1',
      memberId: 'member-1',
      serviceType: 'sunday_service',
      attendanceMethod: 'manual',
      headcount: 1,
      attendedAt: new Date('2026-07-05'),
      deletedAt: null,
    };

    it('re-checks uniqueness only when the composite key actually changes', async () => {
      mockPrisma.attendanceRecord.findFirst
        .mockResolvedValueOnce(existingRecord) // findOne
        .mockResolvedValueOnce(null); // duplicate check
      mockPrisma.attendanceRecord.update.mockResolvedValue({ ...existingRecord, notes: 'Late arrival' });

      await service.update(TENANT_ID, 'att-1', { serviceType: 'bible_study' } as any);

      expect(mockPrisma.attendanceRecord.findFirst).toHaveBeenCalledTimes(2);
    });

    it('skips the uniqueness re-check when nothing identity-relevant changed', async () => {
      mockPrisma.attendanceRecord.findFirst.mockResolvedValueOnce(existingRecord); // findOne only
      mockPrisma.attendanceRecord.update.mockResolvedValue({ ...existingRecord, notes: 'Late arrival' });

      await service.update(TENANT_ID, 'att-1', { notes: 'Late arrival' } as any);

      expect(mockPrisma.attendanceRecord.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt and isActive=false rather than removing the row', async () => {
      mockPrisma.attendanceRecord.findFirst.mockResolvedValue({ id: 'att-1', deletedAt: null });
      mockPrisma.attendanceRecord.update.mockResolvedValue({ id: 'att-1', isActive: false });

      await service.softDelete(TENANT_ID, 'att-1');

      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'att-1' },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });
  });

  describe('findAll / summary filters', () => {
    it('always excludes soft-deleted records', async () => {
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);
      mockPrisma.attendanceRecord.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { page: 1, pageSize: 20 } as any);

      expect(mockPrisma.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, deletedAt: null }) }),
      );
    });

    it('summary groups totals by serviceType', async () => {
      mockPrisma.attendanceRecord.groupBy.mockResolvedValue([
        { serviceType: 'bible_study', _sum: { headcount: 42 }, _count: { _all: 42 } },
        { serviceType: 'sunday_service', _sum: { headcount: 214 }, _count: { _all: 3 } },
      ]);

      const result = await service.summary(TENANT_ID, { page: 1, pageSize: 20 } as any);

      expect(result).toEqual([
        { serviceType: 'bible_study', totalAttendance: 42, recordCount: 42 },
        { serviceType: 'sunday_service', totalAttendance: 214, recordCount: 3 },
      ]);
    });
  });
});
