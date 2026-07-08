import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Staff } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffQueryDto } from './dto/staff-query.dto';

/**
 * Staff (HR) records — see docs/hr-payroll/business-analysis.md. Unlike the
 * transactional records in Finance/Attendance/Events, `Staff` carries its
 * own name always; `memberId` is an optional link to an existing
 * congregation Member, not a substitute for one.
 */
@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateStaffDto): Promise<Staff> {
    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }
    if (dto.memberId) {
      await this.assertMemberExists(tenantId, dto.memberId);
      await this.assertMemberNotAlreadyStaff(tenantId, dto.memberId);
    }

    return this.prisma.staff.create({
      data: {
        tenantId,
        memberId: dto.memberId ?? null,
        branchId: dto.branchId ?? null,
        firstName: dto.firstName,
        lastName: dto.lastName,
        position: dto.position,
        department: dto.department,
        employmentType: dto.employmentType,
        employmentStatus: dto.employmentStatus ?? 'active',
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        baseSalary: dto.baseSalary,
        salaryCurrency: dto.salaryCurrency,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: StaffQueryDto) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.employmentStatus ? { employmentStatus: query.employmentStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.staff.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<Staff> {
    const staff = await this.prisma.staff.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!staff) throw new NotFoundException({ code: 'STAFF_NOT_FOUND', message: 'Staff record not found.' });
    return staff;
  }

  async update(tenantId: string, id: string, dto: UpdateStaffDto): Promise<Staff> {
    const existing = await this.findOne(tenantId, id);

    if (dto.branchId && dto.branchId !== existing.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }
    if (dto.memberId && dto.memberId !== existing.memberId) {
      await this.assertMemberExists(tenantId, dto.memberId);
      await this.assertMemberNotAlreadyStaff(tenantId, dto.memberId, id);
    }

    return this.prisma.staff.update({
      where: { id },
      data: {
        memberId: dto.memberId,
        branchId: dto.branchId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        position: dto.position,
        department: dto.department,
        employmentType: dto.employmentType,
        employmentStatus: dto.employmentStatus,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        terminationDate: dto.employmentStatus === 'terminated' && !existing.terminationDate ? new Date() : undefined,
        baseSalary: dto.baseSalary,
        salaryCurrency: dto.salaryCurrency,
        notes: dto.notes,
      },
    });
  }

  /** Soft-deletes the staff record — payroll history stays intact and queryable. */
  async softDelete(tenantId: string, id: string): Promise<Staff> {
    await this.findOne(tenantId, id);
    return this.prisma.staff.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  private async assertBranchExists(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
  }

  private async assertMemberExists(tenantId: string, memberId: string): Promise<void> {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId, deletedAt: null } });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
  }

  private async assertMemberNotAlreadyStaff(tenantId: string, memberId: string, excludeStaffId?: string): Promise<void> {
    const existing = await this.prisma.staff.findFirst({
      where: { tenantId, memberId, deletedAt: null, ...(excludeStaffId ? { id: { not: excludeStaffId } } : {}) },
    });
    if (existing) {
      throw new ConflictException({
        code: 'STAFF_MEMBER_ALREADY_LINKED',
        message: 'This member already has a staff record.',
      });
    }
  }
}
