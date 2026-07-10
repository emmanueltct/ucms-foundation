# Module 16: Hierarchy Requirements — Configurable Requirements Between Organizational Levels

## 1. Business Description

A denomination's organizational tree (National Church → Diocese → District → Parish →
Branch → Cell, or whatever depth a tenant actually uses) already exists as one tenant's
self-referencing `Branch` tree. What was missing is a way for a parent level to say "every
branch of this type beneath me owes me a report/document/form/activity, on this cadence,
approved by whoever I designate" — and for the child branches to see, fulfil, and track
those obligations.

This module adds exactly that, as a thin layer over three things that already exist:
`Branch.branchType` (which level a branch is), and Module 15's `ApprovalWorkflow` and
`Deadline` (the approval chain and due-date each submission needs). It introduces no new
hierarchy concept — "Diocese requires something of District" is a `HierarchyRequirement`
row keyed by `parentBranchType: "diocese"`, `childBranchType: "district"`, not a
relationship between two specific branches.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).

| Actor | Relevance to this module |
|---|---|
| Church Administrator / parent-level officer | Defines a `HierarchyRequirement` for the level(s) beneath them |
| Child-branch officer | Opens a submission cycle, attaches evidence, and marks it submitted |
| Approver (per the requirement's optional `ApprovalWorkflow`, or the parent-level officer directly) | Approves or rejects a submitted submission, with a mandatory reason |
| Notified role-holders | Users holding a role named in `notifyRoleNames` receive an email when a new cycle opens |

## 3. Key Business Rules

- **A requirement is defined by branch *type*, not by specific branch.** Defining "Diocese
  requires a monthly report from District" once makes it apply to every District under
  every Diocese in the tenant — there is no per-branch duplication of the same rule.
- **`listForBranch` matches a branch's actual parent, not just its own type.** "What does
  this branch owe upward" is resolved by looking up the branch's real
  `parentBranch.branchType` and matching requirements whose `parentBranchType` equals that
  — a District under a Diocese sees Diocese-level requirements; a District that happens to
  sit directly under the National Church (an unusual but permitted tree shape) would not,
  since no requirement names that parent type for it.
- **A submission cycle's `periodLabel` is a concrete, non-null string, never `null`.**
  One-off requirements store `periodLabel: ""` rather than `null` — Postgres treats every
  `NULL` as distinct within a unique index, so a nullable column in the
  `(tenantId, requirementId, branchId, periodLabel)` uniqueness constraint would silently
  allow duplicate one-off submissions. A concrete empty string makes the constraint behave
  as intended.
- **Deadlines and approval chains are resolved by key against Module 15, not stored as
  FKs on the submission.** A submission's deadline is looked up as
  `Deadline(entityType: "hierarchy_requirement_submission", entityId: submission.id)`, and
  its approval chain (if the requirement has one) via
  `ApprovalRequest` on the same key — the same composition trick Custom Fields already
  established for per-category fields, applied here to "a submission's due date/approval
  chain" instead of "a record's extra fields."
- **Approving/rejecting a submission mirrors the decision onto the submission's own
  `status` column**, rather than requiring every read to join `ApprovalRequest`. If the
  requirement has no `approvalWorkflowId`, the decision is recorded directly by
  `HierarchyRequirementsService` via `AuditService` instead of delegating to
  `ApprovalWorkflowsService` — either path ends with the same mandatory-reason audit
  record.
- **Notification on a new cycle opening is immediate, not a scheduled reminder.** Every
  `User` holding one of `notifyRoleNames`' role names gets an email the moment
  `createSubmission` runs, reusing `NotificationsService.create` directly with an explicit
  `recipient` (these are `User.email` addresses, not `Member` contact fields, so
  `memberId`-based recipient resolution doesn't apply here).
- **`frequency`/`dueDayOfPeriod` on the requirement are informational only.** The concrete
  `dueAt` for a given cycle's `Deadline` is set explicitly, per submission, through the
  existing generic `POST /deadlines` endpoint — this module does not compute "the 5th of
  next month" itself.

## 4. Out of Scope for This Module

- **Automatic period-end date arithmetic from `frequency`/`dueDayOfPeriod`** — see the rule
  above. A future enhancement if recurring auto-scheduling is ever asked for; today the
  parent-level officer sets each cycle's concrete due date explicitly.
- **Automated "deadline approaching" reminder notifications** — only the cycle-opened
  notification is sent immediately. Reminder scheduling would reuse the existing
  Communication module's queue in a later pass, consistent with Visitor Management's own
  documented "no automated reminders" scope line.
- **Cross-tenant requirements** — a requirement's parent/child types are branch types
  within one tenant's own `Branch` tree; there is no concept of one tenant (church body)
  imposing requirements on another.
