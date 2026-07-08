import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayrollService } from '../src/hr/payroll.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PayrollService', () => {
  let service: PayrollService;

  const TENANT_ID = 'tenant-1';
  const USER_ID = 'user-1';

  const mockPrisma = {
    payrollPayment: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
    staff: { findFirst: jest.fn() },
    tenant: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [PayrollService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(PayrollService);
  });

  describe('create', () => {
    const baseDto = { staffId: 'staff-1', periodStart: '2026-07-01', periodEnd: '2026-07-31', grossAmount: 500000 };

    it('rejects when staffId does not resolve within the tenant', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue(null);
      await expect(service.create(TENANT_ID, baseDto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects when deductions exceed the gross amount', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', salaryCurrency: 'RWF' });
      await expect(service.create(TENANT_ID, { ...baseDto, deductions: 600000 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('computes netAmount as gross minus deductions and defaults currency from the staff record', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', salaryCurrency: 'RWF' });
      mockPrisma.payrollPayment.create.mockResolvedValue({ id: 'pay-1' });

      await service.create(TENANT_ID, { ...baseDto, deductions: 25000 } as any);

      expect(mockPrisma.payrollPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ netAmount: 475000, currency: 'RWF' }) }),
      );
      expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to the tenant currency when the staff record has none set', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', salaryCurrency: null });
      mockPrisma.tenant.findUnique.mockResolvedValue({ currency: 'USD' });
      mockPrisma.payrollPayment.create.mockResolvedValue({ id: 'pay-1' });

      await service.create(TENANT_ID, baseDto as any);

      expect(mockPrisma.payrollPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currency: 'USD' }) }),
      );
    });
  });

  describe('update', () => {
    it('rejects updating a payment that is not pending', async () => {
      mockPrisma.payrollPayment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'paid' });
      await expect(service.update(TENANT_ID, 'pay-1', { notes: 'x' } as any)).rejects.toThrow(BadRequestException);
    });

    it('recomputes netAmount when grossAmount/deductions change on a pending payment', async () => {
      mockPrisma.payrollPayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: 'pending',
        grossAmount: 500000,
        deductions: 0,
      });
      mockPrisma.payrollPayment.update.mockResolvedValue({ id: 'pay-1' });

      await service.update(TENANT_ID, 'pay-1', { deductions: 50000 } as any);

      expect(mockPrisma.payrollPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ netAmount: 450000 }) }),
      );
    });
  });

  describe('markPaid', () => {
    it('rejects marking an already-paid payment as paid again', async () => {
      mockPrisma.payrollPayment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'paid' });
      await expect(service.markPaid(TENANT_ID, 'pay-1', USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('marks a pending payment paid with a timestamp and the acting user', async () => {
      mockPrisma.payrollPayment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'pending' });
      mockPrisma.payrollPayment.update.mockResolvedValue({ id: 'pay-1', status: 'paid' });

      await service.markPaid(TENANT_ID, 'pay-1', USER_ID);

      expect(mockPrisma.payrollPayment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { status: 'paid', paidAt: expect.any(Date), paidByUserId: USER_ID },
      });
    });
  });

  describe('cancel', () => {
    it('rejects cancelling a payment that has already been paid', async () => {
      mockPrisma.payrollPayment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'paid' });
      await expect(service.cancel(TENANT_ID, 'pay-1', USER_ID, 'mistake')).rejects.toThrow(BadRequestException);
    });

    it('cancels a pending payment with a reason and the acting user', async () => {
      mockPrisma.payrollPayment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'pending' });
      mockPrisma.payrollPayment.update.mockResolvedValue({ id: 'pay-1', status: 'cancelled' });

      await service.cancel(TENANT_ID, 'pay-1', USER_ID, 'Duplicate entry');

      expect(mockPrisma.payrollPayment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { status: 'cancelled', cancelledAt: expect.any(Date), cancelledByUserId: USER_ID, cancelReason: 'Duplicate entry' },
      });
    });
  });
});
