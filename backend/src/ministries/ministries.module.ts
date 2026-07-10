import { Module } from '@nestjs/common';
import { MinistriesService } from './ministries.service';
import { MinistriesController } from './ministries.controller';
import { MinistryMembershipsService } from './ministry-memberships.service';
import { MinistryMembershipsController } from './ministry-memberships.controller';
import { BranchScopeModule } from '../common/branch-scope/branch-scope.module';

@Module({
  imports: [BranchScopeModule],
  controllers: [MinistriesController, MinistryMembershipsController],
  providers: [MinistriesService, MinistryMembershipsService],
  exports: [MinistriesService, MinistryMembershipsService],
})
export class MinistriesModule {}
