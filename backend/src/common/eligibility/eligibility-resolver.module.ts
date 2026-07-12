import { Module } from '@nestjs/common';
import { EligibilityResolverService } from './eligibility-resolver.service';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';

/**
 * Deliberately does NOT import `BranchesModule`, `ResourceAssignmentsModule`,
 * or `DynamicModulesModule` — all three need to depend (the first two
 * transitively, via `FormAssignmentNotifierModule`; the third directly, for
 * row-level record visibility scoping) on this one, so importing any of them
 * back would recreate a circular module dependency.
 * `EligibilityResolverService` queries `Branch`/`DynamicModuleRecord`/
 * `ResourceAssignment` directly via Prisma instead — see that service's own
 * comments on `branchAncestors`/`branchDescendants`,
 * `dynamicModuleRecordAncestors`/`dynamicModuleRecordDescendants`, and
 * `resolveResourcesFor`.
 */
@Module({
  imports: [LeadershipScopeModule],
  providers: [EligibilityResolverService],
  exports: [EligibilityResolverService],
})
export class EligibilityResolverModule {}
