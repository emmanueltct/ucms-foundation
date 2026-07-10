import { Module } from '@nestjs/common';
import { BranchScopeService } from './branch-scope.service';
import { BranchesModule } from '../../branches/branches.module';

@Module({
  imports: [BranchesModule],
  providers: [BranchScopeService],
  exports: [BranchScopeService],
})
export class BranchScopeModule {}
