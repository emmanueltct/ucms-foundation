import { Module } from '@nestjs/common';
import { ResourceAssignmentsService } from './resource-assignments.service';
import { ResourceAssignmentsController } from './resource-assignments.controller';
import { FormAssignmentNotifierModule } from '../common/form-assignment-notifier/form-assignment-notifier.module';

@Module({
  imports: [FormAssignmentNotifierModule],
  controllers: [ResourceAssignmentsController],
  providers: [ResourceAssignmentsService],
  exports: [ResourceAssignmentsService],
})
export class ResourceAssignmentsModule {}
