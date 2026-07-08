import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { CreatePayrollPaymentDto } from './dto/create-payroll-payment.dto';
import { UpdatePayrollPaymentDto } from './dto/update-payroll-payment.dto';
import { CancelPayrollPaymentDto } from './dto/cancel-payroll-payment.dto';
import { PayrollPaymentQueryDto } from './dto/payroll-payment-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('payroll')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('payroll-payments')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @ApiOperation({ summary: 'Create a pending payroll payment for a staff member' })
  @Permissions('payroll.payment.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreatePayrollPaymentDto) {
    return ok(await this.payrollService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List payroll payments (paginated, filterable by staff/status)' })
  @Permissions('payroll.payment.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: PayrollPaymentQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.payrollService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one payroll payment' })
  @Permissions('payroll.payment.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.payrollService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update a still-pending payment (amount/period/notes)' })
  @Permissions('payroll.payment.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdatePayrollPaymentDto) {
    return ok(await this.payrollService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Mark a pending payment as paid' })
  @Permissions('payroll.payment.pay')
  @Patch(':id/mark-paid')
  async markPaid(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return ok(await this.payrollService.markPaid(tenantId, id, user?.userId));
  }

  @ApiOperation({ summary: 'Cancel a pending payment (requires a reason); never possible once paid' })
  @Permissions('payroll.payment.cancel')
  @Patch(':id/cancel')
  async cancel(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelPayrollPaymentDto,
  ) {
    return ok(await this.payrollService.cancel(tenantId, id, user?.userId, dto.cancelReason));
  }
}
