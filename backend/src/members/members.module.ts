import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MemberActivitiesService } from './member-activities.service';
import { MembersController } from './members.controller';
import { FamiliesModule } from '../families/families.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { BranchScopeModule } from '../common/branch-scope/branch-scope.module';
import { AuditModule } from '../audit/audit.module';
import { ApprovalWorkflowsModule } from '../approval-workflows/approval-workflows.module';
import { NumberingSequencesModule } from '../numbering-sequences/numbering-sequences.module';

@Module({
  imports: [FamiliesModule, CustomFieldsModule, BranchScopeModule, AuditModule, ApprovalWorkflowsModule, NumberingSequencesModule],
  controllers: [MembersController],
  providers: [MembersService, MemberActivitiesService],
  exports: [MembersService, MemberActivitiesService],
})
export class MembersModule {}
