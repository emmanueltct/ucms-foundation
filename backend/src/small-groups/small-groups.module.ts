import { Module } from '@nestjs/common';
import { SmallGroupsService } from './small-groups.service';
import { SmallGroupsController } from './small-groups.controller';
import { SmallGroupMembershipsService } from './small-group-memberships.service';
import { SmallGroupMembershipsController } from './small-group-memberships.controller';

@Module({
  controllers: [SmallGroupsController, SmallGroupMembershipsController],
  providers: [SmallGroupsService, SmallGroupMembershipsService],
  exports: [SmallGroupsService, SmallGroupMembershipsService],
})
export class SmallGroupsModule {}
