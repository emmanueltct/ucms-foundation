import { Module } from '@nestjs/common';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import { ApprovalWorkflowsController } from './approval-workflows.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ApprovalWorkflowsController],
  providers: [ApprovalWorkflowsService],
  exports: [ApprovalWorkflowsService],
})
export class ApprovalWorkflowsModule {}
