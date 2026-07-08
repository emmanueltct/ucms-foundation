import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PayrollPayment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePayrollPaymentDto } from './dto/create-payroll-payment.dto';
import { UpdatePayrollPaymentDto } from './dto/update-payroll-payment.dto';
import { PayrollPaymentQueryDto } from './dto/payroll-payment-query.dto';

/**
 * Payroll disbursements — see docs/hr-payroll/business-analysis.md. Follows
 * Finance's stricter pattern (money leaving the church): `netAmount` is
 * fixed at creation, and once a payment is "paid" it's a historical fact —
 * only a still-"pending" payment can be edited or cancelled (with a reason).
 */
@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreatePayrollPaymentDto): Promise<PayrollPayment> {
    const staff = await this.assertStaffExists(tenantId, dto.staffId);
    const currency = dto.currency ?? staff.salaryCurrency ?? (await this.tenantCurrency(tenantId));
    const deductions = dto.deductions ?? 0;

    if (deductions > dto.grossAmount) {
      throw new BadRequestException({
        code: 'PAYROLL_DEDUCTIONS_EXCEED_GROSS',
        message: 'Deductions cannot exceed the gross amount.',
      });
    }

    return this.prisma.payrollPayment.create({
      data: {
        tenantId,
        staffId: dto.staffId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        grossAmount: dto.grossAmount,
        deductions,
        netAmount: dto.grossAmount - deductions,
        currency,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: PayrollPaymentQueryDto) {
    const where = {
      tenantId,
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payrollPayment.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { periodStart: 'desc' },
      }),
      this.prisma.payrollPayment.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<PayrollPayment> {
    const payment = await this.prisma.payrollPayment.findFirst({ where: { id, tenantId } });
    if (!payment) throw new NotFoundException({ code: 'PAYROLL_PAYMENT_NOT_FOUND', message: 'Payroll payment not found.' });
    return payment;
  }

  /** Only reachable while still "pending" — a "paid" or "cancelled" record is a fixed historical fact. */
  async update(tenantId: string, id: string, dto: UpdatePayrollPaymentDto): Promise<PayrollPayment> {
    const existing = await this.findOne(tenantId, id);
    this.assertPending(existing, 'updated');

    const grossAmount = dto.grossAmount ?? Number(existing.grossAmount);
    const deductions = dto.deductions ?? Number(existing.deductions);
    if (deductions > grossAmount) {
      throw new BadRequestException({
        code: 'PAYROLL_DEDUCTIONS_EXCEED_GROSS',
        message: 'Deductions cannot exceed the gross amount.',
      });
    }

    return this.prisma.payrollPayment.update({
      where: { id },
      data: {
        periodStart: dto.periodStart ? new Date(dto.periodStart) : undefined,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : undefined,
        grossAmount: dto.grossAmount,
        deductions: dto.deductions,
        netAmount: dto.grossAmount !== undefined || dto.deductions !== undefined ? grossAmount - deductions : undefined,
        currency: dto.currency,
        notes: dto.notes,
      },
    });
  }

  async markPaid(tenantId: string, id: string, paidByUserId: string | undefined): Promise<PayrollPayment> {
    const existing = await this.findOne(tenantId, id);
    this.assertPending(existing, 'marked as paid');
    return this.prisma.payrollPayment.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date(), paidByUserId },
    });
  }

  async cancel(tenantId: string, id: string, cancelledByUserId: string | undefined, cancelReason: string): Promise<PayrollPayment> {
    const existing = await this.findOne(tenantId, id);
    this.assertPending(existing, 'cancelled');
    return this.prisma.payrollPayment.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelledByUserId, cancelReason },
    });
  }

  private assertPending(payment: PayrollPayment, attemptedAction: string): void {
    if (payment.status !== 'pending') {
      throw new BadRequestException({
        code: 'PAYROLL_PAYMENT_NOT_PENDING',
        message: `This payment is already "${payment.status}" and cannot be ${attemptedAction}.`,
      });
    }
  }

  private async assertStaffExists(tenantId: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({ where: { id: staffId, tenantId, deletedAt: null } });
    if (!staff) throw new NotFoundException({ code: 'STAFF_NOT_FOUND', message: 'Staff record not found.' });
    return staff;
  }

  private async tenantCurrency(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
    return tenant?.currency ?? 'RWF';
  }
}
