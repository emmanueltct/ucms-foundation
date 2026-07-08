import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePayrollPaymentDto } from './create-payroll-payment.dto';

/**
 * `staffId` is immutable — cancel and create a new payment against the
 * correct staff record instead of reassigning one. Only reachable while the
 * payment is still "pending" (see FR-PAY-3.1); a "paid" payment is a
 * historical fact, not editable.
 */
export class UpdatePayrollPaymentDto extends PartialType(OmitType(CreatePayrollPaymentDto, ['staffId'] as const)) {}
