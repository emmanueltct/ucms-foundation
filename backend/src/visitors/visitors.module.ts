import { Module } from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import { VisitorsController } from './visitors.controller';
import { VisitorGroupsService } from './visitor-groups.service';
import { VisitorGroupsController } from './visitor-groups.controller';
import { VisitorActivitiesService } from './visitor-activities.service';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { BranchScopeModule } from '../common/branch-scope/branch-scope.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [CustomFieldsModule, BranchScopeModule, AuditModule],
  controllers: [VisitorsController, VisitorGroupsController],
  providers: [VisitorsService, VisitorGroupsService, VisitorActivitiesService],
  exports: [VisitorsService, VisitorGroupsService, VisitorActivitiesService],
})
export class VisitorsModule {}
