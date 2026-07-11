import { Module } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { HierarchyLevelsModule } from '../hierarchy-levels/hierarchy-levels.module';

@Module({
  imports: [HierarchyLevelsModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
