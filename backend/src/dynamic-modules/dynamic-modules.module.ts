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
import { EligibilityResolverModule } from '../common/eligibility/eligibility-resolver.module';
import { StorageModule } from '../storage/storage.module';

/**
 * Imports `EligibilityResolverModule` for row-level record visibility
 * scoping (a caller without the module-wide `dynamicmodule.{id}.read`
 * permission, but who reached the module through §13 eligibility, sees only
 * records within their own resolved scope — see
 * `DynamicModuleRecordsService.findAll`). Safe in this direction only
 * because `EligibilityResolverService` was refactored to duplicate its own
 * small record-ancestor/descendant walk via direct Prisma queries rather
 * than depending on `DynamicModuleRecordsService` — see that service's own
 * comments.
 */
@Module({
  imports: [AuditModule, ApprovalWorkflowsModule, CustomFieldsModule, ConfigEngineModule, EligibilityResolverModule, StorageModule],
  controllers: [DynamicModuleDefinitionsController, DynamicModuleRecordsController, PublicSubmissionController],
  providers: [DynamicModuleDefinitionsService, DynamicModuleRecordsService],
  exports: [DynamicModuleDefinitionsService, DynamicModuleRecordsService],
})
export class DynamicModulesModule {}
