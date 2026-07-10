import { Module } from '@nestjs/common';
import { DynamicModuleDefinitionsService } from './dynamic-module-definitions.service';
import { DynamicModuleRecordsService } from './dynamic-module-records.service';
import { DynamicModuleDefinitionsController } from './dynamic-module-definitions.controller';
import { DynamicModuleRecordsController } from './dynamic-module-records.controller';
import { AuditModule } from '../audit/audit.module';
import { ApprovalWorkflowsModule } from '../approval-workflows/approval-workflows.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

@Module({
  imports: [AuditModule, ApprovalWorkflowsModule, CustomFieldsModule],
  controllers: [DynamicModuleDefinitionsController, DynamicModuleRecordsController],
  providers: [DynamicModuleDefinitionsService, DynamicModuleRecordsService],
  exports: [DynamicModuleDefinitionsService, DynamicModuleRecordsService],
})
export class DynamicModulesModule {}
