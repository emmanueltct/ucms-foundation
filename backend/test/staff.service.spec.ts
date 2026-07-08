import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { StaffService } from '../src/hr/staff.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('StaffService', () => {
  let service: StaffService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    staff: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
    branch: { findFirst: jest.fn() },
    member: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [StaffService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(StaffService);
  });

  describe('create', () => {
    const baseDto = { firstName: 'Jean', lastName: 'Uwimana', employmentType: 'full_time' };

    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      await expect(service.create(TENANT_ID, { ...baseDto, branchId: 'missing' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects when memberId does not resolve within the tenant', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await expect(service.create(TENANT_ID, { ...baseDto, memberId: 'missing' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects linking a member who already has a staff record', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.staff.findFirst.mockResolvedValue({ id: 'existing-staff' });

      await expect(service.create(TENANT_ID, { ...baseDto, memberId: 'member-1' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates a staff record without a member link', async () => {
      mockPrisma.staff.create.mockResolvedValue({ id: 'staff-1' });

      await service.create(TENANT_ID, baseDto as any);

      expect(mockPrisma.member.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.staff.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ memberId: null, employmentStatus: 'active' }) }),
      );
    });
  });

  describe('update', () => {
    it('sets terminationDate automatically the first time employmentStatus becomes "terminated"', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        tenantId: TENANT_ID,
        employmentStatus: 'active',
        terminationDate: null,
        branchId: null,
        memberId: null,
      });
      mockPrisma.staff.update.mockResolvedValue({ id: 'staff-1', employmentStatus: 'terminated' });

      await service.update(TENANT_ID, 'staff-1', { employmentStatus: 'terminated' } as any);

      expect(mockPrisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ terminationDate: expect.any(Date) }) }),
      );
    });

    it('does not overwrite an existing terminationDate', async () => {
      const existingDate = new Date('2026-01-01');
      mockPrisma.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        tenantId: TENANT_ID,
        employmentStatus: 'terminated',
        terminationDate: existingDate,
        branchId: null,
        memberId: null,
      });
      mockPrisma.staff.update.mockResolvedValue({ id: 'staff-1' });

      await service.update(TENANT_ID, 'staff-1', { notes: 'updated notes' } as any);

      expect(mockPrisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ terminationDate: undefined }) }),
      );
    });
  });

  describe('softDelete', () => {
    it('deactivates the staff record without touching payroll history', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
      mockPrisma.staff.update.mockResolvedValue({ id: 'staff-1', isActive: false });

      await service.softDelete(TENANT_ID, 'staff-1');

      expect(mockPrisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff-1' },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });
  });
});
