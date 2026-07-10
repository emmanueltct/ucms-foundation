import { Module } from '@nestjs/common';
import { EntityMembershipsService } from './entity-memberships.service';
import { EntityMembershipsController } from './entity-memberships.controller';

@Module({
  controllers: [EntityMembershipsController],
  providers: [EntityMembershipsService],
  exports: [EntityMembershipsService],
})
export class EntityMembershipsModule {}
