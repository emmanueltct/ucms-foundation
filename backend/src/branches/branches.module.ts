import { Module } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { HierarchyLevelsModule } from '../hierarchy-levels/hierarchy-levels.module';
import { LeadershipScopeModule } from '../common/leadership-scope/leadership-scope.module';
import { FormAssignmentNotifierModule } from '../common/form-assignment-notifier/form-assignment-notifier.module';

/**
 * Deliberately does NOT import `ResourceAssignmentsModule` directly —
 * `EligibilityResolverService` (which `FormAssignmentNotifierModule`
 * transitively depends on) duplicates its own small `Branch` ancestor/
 * descendant tree-walk rather than depending on `BranchesService`,
 * specifically so this module could safely import
 * `FormAssignmentNotifierModule` here without a circular dependency.
 * `BranchesService` queries `ResourceAssignment` directly via Prisma too.
 */
@Module({
  imports: [HierarchyLevelsModule, LeadershipScopeModule, FormAssignmentNotifierModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
