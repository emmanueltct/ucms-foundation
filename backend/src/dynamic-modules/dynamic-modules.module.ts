import { Module } from '@nestjs/common';
import { DynamicModuleDefinitionsService } from './dynamic-module-definitions.service';
import { DynamicModuleRecordsService } from './dynamic-module-records.service';
import { DynamicModuleDefinitionsController } from './dynamic-module-definitions.controller';
import { DynamicModuleRecordsController } from './dynamic-module-records.controller';
import { PublicSubmissionController } from './public-submission.controller';
import { AuditModule } from '../audit/audit.module';
import { ApprovalWorkflowsModule } from '../approval-workflows/approval-workflows.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { ConfigEngineModule } from '../config-engine/config.module';

@Module({
  imports: [AuditModule, ApprovalWorkflowsModule, CustomFieldsModule, ConfigEngineModule],
  controllers: [DynamicModuleDefinitionsController, DynamicModuleRecordsController, PublicSubmissionController],
  providers: [DynamicModuleDefinitionsService, DynamicModuleRecordsService],
  exports: [DynamicModuleDefinitionsService, DynamicModuleRecordsService],
})
export class DynamicModulesModule {}
