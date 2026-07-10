# Module 15: Governance — Audit, Approval Workflows & Deadlines

## 1. Business Description

Three needs recur across every later module in the platform's expanded requirements list
(configurable requirements between organizational levels, a Dynamic Module Builder, member
registration): *someone approved this, in what order*; *this has to happen by a date, and
what happens after*; and *this change must carry a reason, permanently*. Rather than build
three bespoke mechanisms — one for member-registration approval, one for a hierarchy
requirement's sign-off chain, one for a Dynamic Module's status transitions — this module
builds each concept once, generically, keyed by a free-form `(entityType, entityId)` pair
the same way Custom Fields keys its values. Every later module is a *consumer* of this one,
not a reimplementation of it.

This is Module 15 — it depends on nothing module-specific (only the Foundation module's
`User`/`Role`/`Permission` for "who can approve/extend/close"), and everything from Module
16 onward (Hierarchy Requirements, Dynamic Modules, Member Registration) depends on it.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actors most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator | Defines approval workflows and sets deadlines |
| Approver (any role/permission named in a workflow step) | Approves or rejects a pending request, with a mandatory reason |
| Any user performing a "named hot-spot" action (Phase 6) | Must supply a reason; it becomes part of the permanent audit history |

## 3. Key Business Rules

- **`AuditLog` generalizes from an auth-only log into shared, injectable
  infrastructure.** Before this module, `AuditLog` was written exclusively by
  `AuthService` (login/logout/MFA) — a private `audit()` helper duplicated nowhere else,
  despite FR-5.1 in the Foundation module's docs claiming "role changes and config
  changes" were audited too. `AuditService` (`backend/src/audit/audit.service.ts`) is that
  helper promoted into an injectable service any module calls; `AuthService` now delegates
  to it through the exact same private method signature, so none of its ~11 call sites
  needed to change.
- **`reason`/`previousValue`/`newValue` are first-class `AuditLog` columns, not folded
  into the generic `metadata` field.** They are queried on directly (a member's edit
  history, a deadline's extension history) and mandatory for the specific actions this
  platform names — a `Json?` blob that may or may not contain them would make that
  querying and that mandate both weaker.
- **Mandatory-reason enforcement is opt-in per route, not automatic for every mutation.**
  `@RequiresAuditReason()` + `RequiresAuditReasonGuard` (the same metadata-and-guard shape
  `@Permissions()`/`PermissionsGuard` already use) mark only the specific "important
  record" actions the requirements name (removing a member, approving/rejecting,
  extending/closing/reopening a deadline). A route's own DTO extending `RequireReasonDto`
  gives the friendly class-validator error message; the guard is defense-in-depth that
  survives even if a DTO were ever misshapen.
- **Approval workflows are a linear, ordered chain — not an arbitrary state-machine or
  BPMN engine.** `ApprovalWorkflow` (one per `entityType`, e.g. `"member_registration"`)
  owns an ordered list of `ApprovalStep`s, each gated by exactly one of a role name or a
  permission code (mirroring `@Roles`/`@Permissions`' own either/or shape). Nothing in the
  requirements this serves ("approval workflows," "who approves this, in what order")
  asks for conditional branching or parallel paths, so none is built.
- **An `ApprovalRequest` is the one running instance per entity — `startRequest` is
  idempotent.** Calling it twice for the same `(entityType, entityId)` never creates a
  duplicate; it returns the existing request. Individual decisions are *not* stored in a
  fourth dedicated table — `decide()` writes to `AuditLog` (action
  `approval.approved`/`approval.rejected`, `reason` mandatory) since that log is already
  the platform's source of truth for "who did what, when, why."
- **A `Deadline`'s "locked" state is derived at read time, never stored.**
  `Deadline.status` is only ever persisted as `"open"` or `"closed"`;
  `DeadlinesService.effectiveStatus` computes `"locked"` on the fly from `dueAt` vs. now.
  This means no scheduled job is needed just to flip a flag — the tradeoff is that a
  direct SQL query for "all currently locked deadlines" isn't possible without loading
  rows into application code first, judged an acceptable cost against not needing cron
  infrastructure for something this cheap to compute per read.
- **`extend`/`close`/`reopen` are separate, separately-permissioned actions**, the same
  "a field with real side effects earns its own endpoint" reasoning `Visitor.convertToMember`
  and `Member.transfer` already established (root README design decisions #6/#8/#26).
  `reopen` is deliberately gated by its own permission (`deadline.reopen`), distinct from
  `deadline.close` — closing something is routine; reopening a closed record is the more
  sensitive action and a tenant may want a narrower set of roles able to do it.
- **`resolveVisibleBranchIds` reuses `BranchesService.findDescendants` rather than a new
  hierarchy-walking implementation.** That method already existed (built for the
  deactivate-cascade in Module 1) and already does exactly what organizational-visibility
  roll-up needs — a Diocese-assigned user should see everything at and beneath their
  assigned `Branch`. Returning `null` (meaning "unrestricted") when `User.assignedBranchId`
  is unset is the default for every existing user, so tenants that never adopt per-user
  branch assignment are entirely unaffected by this mechanism existing.

## 4. Out of Scope for This Module

- **Conditional/branching approval workflows** (different next-step depending on the
  decision's content, parallel simultaneous approvers) — see the linear-chain rule above.
  A real, future need if it ever comes up, not built speculatively now.
- **A dedicated `ApprovalDecision` history table separate from `AuditLog`** — the audit
  log already captures who/when/why for every decision; a second table would just be a
  second source of truth for the same fact.
- **Scheduled/cron-driven deadline transitions or reminder dispatch** — this module
  computes `effectiveStatus` lazily on read. Notification reminders as a deadline
  approaches are Hierarchy Requirements' concern (a later module), reusing the existing
  Communication module's queue, not this module's.
- **Wiring `@RequiresAuditReason()` onto every mutating endpoint in the system** — only
  the named "important record" actions get it (a later phase of the current
  implementation pass). Blanket-instrumenting dozens of unrelated endpoints was never
  asked for and would make routine edits (e.g. fixing a typo in a member's phone number)
  needlessly heavy.
