import { Module } from '@nestjs/common';
import { ResourceAssignmentsService } from './resource-assignments.service';
import { ResourceAssignmentsController } from './resource-assignments.controller';

@Module({
  controllers: [ResourceAssignmentsController],
  providers: [ResourceAssignmentsService],
  exports: [ResourceAssignmentsService],
})
export class ResourceAssignmentsModule {}
