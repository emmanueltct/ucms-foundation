# Organizational Visibility Roll-up

## 1. Business Description

Requirement #4 of the platform's expanded scope: "higher institutions automatically see
everything beneath them in the hierarchy" — a Diocese-assigned user should see every
District, Parish, Branch, and Cell under their Diocese without being separately granted
access to each one. This is not a new module with its own endpoints; it's a cross-cutting
behavior change layered onto the list endpoints of seven already-shipped modules (Members,
Visitors, Contributions, Attendance, Ministries, Events, Documents), reusing
`BranchScopeService` (Module 15/governance, Phase 0) and `BranchesService.findDescendants`
(Module 1, originally built for the branch deactivate-cascade).

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).

| Actor | Relevance |
|---|---|
| A user with `User.assignedBranchId` set | Sees records at and beneath their assigned branch, automatically, on every list endpoint this pass touched |
| A user with no `assignedBranchId` (the default) | Unaffected — sees everything they could see before this pass, exactly as before |

## 3. Key Business Rules

- **Unset `User.assignedBranchId` (the default for every user, on every tenant) means
  fully unrestricted — this mechanism is opt-in per user, not a breaking change.**
  `BranchScopeService.resolveVisibleBranchIds` returns `null` in that case, and every
  touched service's `buildWhere` treats `null` as "apply no additional filter." A tenant
  that never assigns branches to users is completely unaffected by this feature existing.
- **The filter is additive to, not a replacement for, an explicit `?branchId=` query
  param.** If a caller both has a restricted visibility set *and* asks for a specific
  branch, the two are intersected: a request for a branch outside what they're allowed to
  see resolves to zero results (an impossible filter), never silently substituting a
  branch the caller didn't ask for and never silently widening past what they asked for.
- **Two variants of the merge function exist because two different shapes of entity
  exist.** `resolveBranchFilter` is for entities that always belong to exactly one branch
  (Member, Visitor, Contribution, AttendanceRecord) — TypeScript's own generated Prisma
  types reject `null` for these columns, so a shared "maybe null" return type would force
  an unsound cast. `resolveBranchFilterIncludingChurchWide` is for entities that may
  themselves be church-wide (Ministry, Event, Document, all of which have a nullable
  `branchId`) — a branch-scoped user should still see church-wide records, since roll-up
  visibility is meant to add what a scoped user can see, never take away access to
  something already open to everyone.
- **The church-wide variant composes its condition under `AND: [{ OR: [...] }]`, not a
  bare `OR` key**, specifically so it can be spread into the same `where` object as a
  caller's own `OR` clause (Documents' title/description search) without one silently
  overwriting the other. `AND` and `OR` are different object keys — no collision — while
  two callers each producing a bare `OR` key would collide via object-spread, with
  whichever is spread last winning.
- **Both merge functions are pure, DI-free functions**, not a method on
  `BranchScopeService` itself — every touched service's `buildWhere` can call them
  directly and they're trivially unit-tested in isolation from Prisma/Nest entirely.
- **Reports & Analytics is explicitly out of scope for this pass** — see below.

## 4. Out of Scope for This Module

- **Reports & Analytics.** Unlike the seven modules above, Reports has no single shared
  `buildWhere` — each summary endpoint (finance totals, attendance totals, membership
  trends, payroll totals, the per-member activity timeline) builds its own aggregation
  query independently. Retrofitting branch-scoping across all of them is a real, sizeable
  piece of work in its own right and wasn't bundled into this pass; a future pass can add
  it the same way, reusing the same `resolveBranchFilter`/
  `resolveBranchFilterIncludingChurchWide` helpers.
- **HR & Payroll, Assets, Small Groups.** Not named in the original requirement's example
  list ("members, visitors, activities, ministries, choirs, committees, reports,
  contributions, statistics, attendance, events, documents, dashboards") and not
  retrofitted in this pass — a defensible, bounded scope line rather than a blanket
  "every list endpoint in the system," consistent with how mandatory-audit-reason
  enforcement (Module 15) was scoped to a named list rather than every mutation.
- **UI affordances for assigning `User.assignedBranchId` itself.** This pass wires the
  *consumption* side (list endpoints respecting the assignment); a settings UI for an
  admin to actually assign a branch to a user is not part of this pass — today it can only
  be set directly via the Users API/database, the same as any other field on `User` not
  yet exposed in a dedicated settings screen.
