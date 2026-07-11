import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { BranchScopeModule } from '../common/branch-scope/branch-scope.module';
import { NumberingSequencesModule } from '../numbering-sequences/numbering-sequences.module';

@Module({
  imports: [BranchScopeModule, NumberingSequencesModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
