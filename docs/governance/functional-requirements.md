# Functional Requirements — Governance (Audit, Approval Workflows & Deadlines)

## FR-GOV-1 Audit Service

- FR-GOV-1.1 `AuditService.record(tenantId, userId, action, entityType, entityId, context?)`
  writes one `AuditLog` row. `context` may include `reason`, `previousValue`, `newValue`
  (each a first-class column), `ipAddress`, `userAgent` (folded into `metadata`), and any
  additional `metadata`.
- FR-GOV-1.2 `AuthService` continues to be the platform's heaviest caller (login, logout,
  MFA enable/disable, password reset, email verification, workspace switch) but now
  delegates to `AuditService` instead of writing to `PrismaService` directly — every
  existing audited action keeps recording identically.
- FR-GOV-1.3 `AuditLog.reason`/`previousValue`/`newValue` are nullable — most audit
  entries (e.g. a routine login) have none of the three; only actions marked
  `@RequiresAuditReason()` (FR-GOV-2) are required to populate `reason`.

## FR-GOV-2 Mandatory Audit Reason

- FR-GOV-2.1 A route decorated `@RequiresAuditReason()` is guarded by
  `RequiresAuditReasonGuard`, which rejects the request with
  `400 AUDIT_REASON_REQUIRED` unless `request.body.reason` is a string of at least 3
  characters (after trimming).
- FR-GOV-2.2 DTOs for such routes extend `RequireReasonDto` (`{ reason: string }`,
  `@IsString() @MinLength(3)`) so the class-validator pipeline also produces a
  field-level `422` error before the guard is even reached, for a better client-facing
  error message.
- FR-GOV-2.3 This decorator is applied only to the specific actions later phases name
  (member removal/status change, approval decisions, deadline extend/close/reopen) — it
  is not a blanket requirement on every mutating endpoint.

## FR-GOV-3 Approval Workflows

- FR-GOV-3.1 `POST /approval-workflows` creates an `ApprovalWorkflow` for one
  `entityType` with an ordered array of `steps` (each `{ label, approverRoleName? }` or
  `{ label, approverPermissionCode? }` — exactly one of the two gates per step).
  `stepOrder` is derived from array position (1-indexed), not client-supplied.
- FR-GOV-3.2 `GET /approval-workflows?entityType=` lists workflows, optionally filtered.
  `GET /approval-workflows/:id` returns one, including its ordered steps.
- FR-GOV-3.3 `PATCH /approval-workflows/:id` may change `name`/`isActive` only — steps are
  fixed once a workflow is created (delete and recreate to change the step chain).
- FR-GOV-3.4 `startRequest(tenantId, workflowId, entityType, entityId)` is idempotent: a
  second call for the same `(entityType, entityId)` returns the existing `ApprovalRequest`
  rather than creating a duplicate (enforced by a unique constraint, not just application
  logic).
- FR-GOV-3.5 `GET /approval-workflows/requests/:entityType/:entityId` returns the current
  request for that entity, including its workflow and steps, or `null` if none exists.
- FR-GOV-3.6 `PATCH /approval-workflows/requests/:entityType/:entityId/approve` and
  `.../reject` are `@RequiresAuditReason()`. Approving the *last* step marks the whole
  request `"approved"`; approving any earlier step advances `currentStepOrder` and leaves
  the request `"pending"`; rejecting at any step immediately marks the request
  `"rejected"` — there is no way to un-reject.
- FR-GOV-3.7 A decision is rejected with `403 APPROVAL_STEP_FORBIDDEN` unless the calling
  user is a platform admin or holds the current step's gating role/permission. A decision
  on an already-`approved`/`rejected` request is rejected with
  `400 APPROVAL_REQUEST_ALREADY_DECIDED`.
- FR-GOV-3.8 Every decision is written to `AuditLog` (`approval.approved`/
  `approval.rejected`, entityType `approval_request`, `reason` mandatory,
  `previousValue`/`newValue` capturing the status/step transition) — there is no separate
  decision-history table.

## FR-GOV-4 Deadlines

- FR-GOV-4.1 `POST /deadlines` sets a `Deadline` against one `(entityType, entityId)` pair
  with a `dueAt`. A second deadline for the same pair is rejected by the underlying unique
  constraint.
- FR-GOV-4.2 `GET /deadlines/:entityType/:entityId` returns the stored record plus a
  derived `effectiveStatus`: `"closed"` if the stored status is closed; otherwise
  `"locked"` if `dueAt` has passed, else `"open"`. `effectiveStatus` is computed on every
  read, never persisted as `"locked"` in the database.
- FR-GOV-4.3 `PATCH /deadlines/:entityType/:entityId/extend` (`@RequiresAuditReason()`,
  body includes a new `dueAt`) is rejected with `400 DEADLINE_NOT_LOCKED` unless the
  deadline's current `effectiveStatus` is `"locked"`. On success, `dueAt` moves forward
  and `extendedByUserId`/`extensionReason` are recorded on the row itself (in addition to
  the `AuditLog` entry).
- FR-GOV-4.4 `PATCH /deadlines/:entityType/:entityId/close` (`@RequiresAuditReason()`) is
  rejected with `400 DEADLINE_ALREADY_CLOSED` if already closed; otherwise sets
  `status: "closed"`, `closedAt: now`.
- FR-GOV-4.5 `PATCH /deadlines/:entityType/:entityId/reopen` (`@RequiresAuditReason()`) is
  rejected with `400 DEADLINE_NOT_CLOSED` unless the deadline is currently closed; sets
  `status: "open"`, `closedAt: null`. Gated by its own permission (`deadline.reopen`),
  distinct from `deadline.close`.
- FR-GOV-4.6 `DeadlinesService.assertOpen(tenantId, entityType, entityId)` is the check
  consuming modules call before allowing an edit/submission: a no-op if no deadline is
  configured for that entity, otherwise throws `400 DEADLINE_NOT_OPEN` unless
  `effectiveStatus` is `"open"`.

## FR-GOV-5 Organizational Visibility Roll-up

- FR-GOV-5.1 `User.assignedBranchId` (nullable) records which `Branch` a user is assigned
  to for visibility purposes. Unset (the default for every existing user) means
  unrestricted/church-wide visibility.
- FR-GOV-5.2 `BranchScopeService.resolveVisibleBranchIds(tenantId, userId)` returns `null`
  (unrestricted) when `assignedBranchId` is unset, otherwise
  `[assignedBranchId, ...descendants]`, reusing `BranchesService.findDescendants` — the
  same descendant-flattening logic already used by the branch deactivate-cascade.
- FR-GOV-5.3 This module only provides the resolver; wiring it into each list endpoint's
  `WHERE branchId IN (...)` filter is done per-module in a later implementation phase, not
  as part of this module.

## FR-GOV-6 Non-Functional

- FR-GOV-6.1 `ApprovalWorkflow`, `ApprovalStep`, `ApprovalRequest`, `Deadline` are added to
  the Prisma tenant-scoping extension's `TENANT_SCOPED_MODELS` set. `AuditLog` was already
  registered.
- FR-GOV-6.2 New permission codes: `approval_workflow.create`, `approval_workflow.read`,
  `approval_workflow.update`, `approval_workflow.decide`, `deadline.create`,
  `deadline.read`, `deadline.extend`, `deadline.close`, `deadline.reopen`.
- FR-GOV-6.3 All mutations go through the same `@Permissions(...)` guard and tenant
  scoping as every other module; `@RequiresAuditReason()` is an additional, independent
  guard layered on top for the specific routes that declare it.
