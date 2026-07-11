import { Module } from '@nestjs/common';
import { DynamicModulesModule } from '../dynamic-modules/dynamic-modules.module';
import { ResourceAssignmentsModule } from '../resource-assignments/resource-assignments.module';
import { DepartmentScopeModule } from '../common/department-scope/department-scope.module';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';

@Module({
  imports: [DynamicModulesModule, ResourceAssignmentsModule, DepartmentScopeModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
