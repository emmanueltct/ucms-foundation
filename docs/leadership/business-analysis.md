# Module 18: Leadership-Based Access, Eligibility Resolution & Form Assignment

## 1. Business Description

Two existing mechanisms already scope a user to part of the church: `User.assignedBranchId`
(Church & Hierarchy Management) and `User.assignedDepartmentRecordId`/`departmentRole`
(Departments). Both are hardcoded, single-column, one-scope-per-user. §11 asked for something
broader: a user may be appointed **leader of any organizational unit or custom entity** —
a Branch, a Ministry, a Committee, a Dynamic Module record — with that appointment
auto-granting access to whatever is assigned to that unit. §13 then asked for the reverse
question: given a user, what is every resource (a form, a report, a dashboard) currently
eligible to them, across every scope they belong to at once? This module answers both,
additively, without touching the two existing mechanisms.

This is Module 18 — it depends on Church & Hierarchy Management (Branch), Departments
(Dynamic Module records), and Dynamic Modules (`DynamicModuleDefinition`/`ResourceAssignment`)
as data sources, and is itself a dependency of the My Forms dashboard and the assignment-time
notification fan-out described below.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator | Appoints a user as leader of any unit; assigns forms/reports to a scope with an optional deadline |
| Branch Administrator (a leadership appointment over a Branch) | Gains the same delegated user-registration path a Department Leader already had over their own department — see [../church-hierarchy/business-analysis.md](../church-hierarchy/business-analysis.md) §5 |
| Any user with at least one resolved scope | Sees exactly the forms assigned to any scope they belong to on their My Forms dashboard, with a notification at assignment time |

## 3. Key Business Rules

- **`LeadershipAppointment` (`targetEntityType`, `targetEntityId`, `userId`, `role`) is the
  third sibling of an already-established polymorphic convention** — `ResourceAssignment`
  answers "what's assigned to this scope," `EntityMembership` answers "who's a member of this
  thing," and `LeadershipAppointment` answers "who leads this thing." It is additive alongside
  `User.assignedBranchId`/`assignedDepartmentRecordId`, which keep working completely
  unchanged — no migration consolidates the three onto one mechanism (see Non-Goals).
- **`LeadershipScopeService.isLeaderOf` is the one row-level check every consumer shares.**
  `BranchesService.assignResource` accepts it as an alternative to the static `branch.update`
  permission (an Assigned Administrator manages their own branch's resources without needing
  a tenant-wide grant); `UsersService.create` accepts it as an alternative to `user.create`
  (a Branch Administrator registers users into their own branch only, force-setting
  `assignedBranchId` server-side and rejecting any attempt to target a different branch).
- **`EligibilityResolverService` is a resolution *direction* over existing tables, not a new
  attachment mechanism.** `resolveScopesFor(tenantId, userId)` unions: the user's branch plus
  every ancestor (`Branch.parentBranchId` walked up), their department record plus every
  ancestor (via a new `DynamicModuleRecordsService.ancestors()`, mirroring `Branch`'s own
  ancestor walk), every `LeadershipAppointment` target, and a resolved `user_category`
  `ConfigItem` (namespace `"user_category"`, e.g. Staff/Volunteer/Leader — nullable, additive).
  `resolveResourcesFor` then unions `ResourceAssignment.resolveForScope` across every one of
  those scopes, deduplicated by assignment id. The reverse direction,
  `resolveUsersEligibleForScope`, is what powers assignment-time notification: given one scope,
  every user whose own resolved scopes include it (branch/department roll-up, direct
  `user_category` match, or a direct `LeadershipAppointment`), deduplicated by user id.
- **Members/Visitors/Guests are explicitly outside this resolver's scope.** They are not `User`
  rows — the existing public/guest-submission mechanism (Configuration Center's Guest Access)
  already serves them, and folding them into a `User`-shaped eligibility resolver would require
  either a fictitious `User` row per member or a second, parallel resolver; neither was needed
  by anything this spec actually asked for.
- **A circular NestJS module dependency was resolved by extraction, not by injecting one
  service into the other.** `EligibilityResolverService`, `BranchesService`, and
  `ResourceAssignmentsService` each needed something from at least one of the other two,
  which is unresolvable as direct `@Module` imports. The fix: `EligibilityResolverService`
  duplicates `BranchesService`'s small ancestor/descendant tree-walk via direct `this.prisma
  .branch` queries (rather than importing `BranchesModule`) and queries `ResourceAssignment`
  directly via Prisma (rather than importing `ResourceAssignmentsModule`); the shared
  "notify eligible users when a form is assigned" logic that both `BranchesService` and
  `ResourceAssignmentsService` needed was extracted into a new, dependency-isolated
  `FormAssignmentNotifier` module that only depends on `EligibilityResolverModule` and
  `CommunicationModule` — never on `BranchesModule` or `ResourceAssignmentsModule` — so
  neither of those two can end up depending on it in a cycle.
- **A form/report assignment is just a `ResourceAssignment` whose `resourceType` is
  `"dynamic_module_definition"`, with an optional `dueAt`.** No new "assignment" table:
  `ResourceAssignment.create` unconditionally hands the freshly created row to
  `FormAssignmentNotifier.notifyIfForm`, which is a no-op for every other `resourceType` and,
  for a form, resolves every currently-eligible user for that scope and queues one
  `Notification` each (never letting one user's failure block the others).
- **"My Forms" is a read composed entirely from the resolver, not a new assignment listing.**
  `MyFormsService.list` calls `resolveResourcesFor(tenantId, userId, "dynamic_module_definition")`,
  collapses duplicates by keeping the earliest deadline when the same form reaches a user
  through more than one scope, and joins in the user's own `DynamicModuleRecord`s against each
  definition. `MyFormsController` deliberately has no static `@Permissions()` — eligibility
  itself is the access control, matching the same pattern `UsersService.create`'s delegated
  path and `DepartmentsService.assignResource`'s inline leader check already established.

## 4. Out of Scope for This Module

- **Migrating `User.assignedBranchId`/`assignedDepartmentRecordId`/`departmentRole` onto
  `LeadershipAppointment`** — kept exactly as-is; `LeadershipAppointment` is additive for
  everything those two fields don't already cover. A future consolidation is possible but
  wasn't asked for here and would be a much larger, riskier migration than this spec's actual
  requirement.
- **A notification-rules/trigger automation engine** — the assignment-time fan-out this module
  builds covers the spec's stated need ("notify eligible users when a form is assigned"); a
  broader "if X then notify Y" rules engine is a different, larger feature.
- **Members/Visitors/Guests in the eligibility resolver** — see the rule above; they're already
  served by the existing public/guest-submission mechanism, a different actor and a different
  access boundary.
- **A generic "who can see this" permission-string for eligibility-gated routes** — eligibility
  is checked by calling the resolver directly (`My Forms`, `FormAssignmentNotifier`), not by a
  new declarative decorator alongside `@Permissions()`/`@Roles()`. Nothing here needed a third
  declarative authorization primitive on top of the two the platform already has.
