import { Module } from '@nestjs/common';
import { DynamicModulesModule } from '../dynamic-modules/dynamic-modules.module';
import { ResourceAssignmentsModule } from '../resource-assignments/resource-assignments.module';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';

@Module({
  imports: [DynamicModulesModule, ResourceAssignmentsModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
