import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';

@Module({
  controllers: [StaffController, PayrollController],
  providers: [StaffService, PayrollService],
  exports: [StaffService, PayrollService],
})
export class HrModule {}
