import { Module } from '@nestjs/common';
import { HierarchyRequirementsService } from './hierarchy-requirements.service';
import { HierarchyRequirementsController } from './hierarchy-requirements.controller';
import { AuditModule } from '../audit/audit.module';
import { ApprovalWorkflowsModule } from '../approval-workflows/approval-workflows.module';
import { DeadlinesModule } from '../deadlines/deadlines.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [AuditModule, ApprovalWorkflowsModule, DeadlinesModule, CommunicationModule],
  controllers: [HierarchyRequirementsController],
  providers: [HierarchyRequirementsService],
  exports: [HierarchyRequirementsService],
})
export class HierarchyRequirementsModule {}
