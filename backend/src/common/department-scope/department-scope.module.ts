import { Module } from '@nestjs/common';
import { DepartmentScopeService } from './department-scope.service';
import { DynamicModulesModule } from '../../dynamic-modules/dynamic-modules.module';

@Module({
  imports: [DynamicModulesModule],
  providers: [DepartmentScopeService],
  exports: [DepartmentScopeService],
})
export class DepartmentScopeModule {}
