# Functional Requirements — Hierarchy Requirements

## FR-HR-1 Defining Requirements

- FR-HR-1.1 `POST /hierarchy-requirements` creates a `HierarchyRequirement` with
  `parentBranchType`, `childBranchType`, `kind` (`report`|`document`|`form`|`activity`|
  `compliance`), `label`, and optionally `description`, `frequency`
  (`once`|`monthly`|`quarterly`|`annually`, default `once`), `dueDayOfPeriod` (1-31,
  informational), `approvalWorkflowId` (validated to belong to this tenant), and
  `notifyRoleNames`.
- FR-HR-1.2 `GET /hierarchy-requirements` lists active requirements, optionally filtered by
  `parentBranchType`/`childBranchType`/`kind`.
- FR-HR-1.3 `PATCH /hierarchy-requirements/:id` may update `label`, `description`,
  `frequency`, `dueDayOfPeriod`, `approvalWorkflowId`, `notifyRoleNames`, `isActive`.
  `parentBranchType`/`childBranchType`/`kind` are immutable once created.
- FR-HR-1.4 `DELETE /hierarchy-requirements/:id` soft-deletes (`deletedAt`, `isActive:
  false`) — existing submissions against it are untouched.

## FR-HR-2 What a Branch Owes Upward

- FR-HR-2.1 `GET /hierarchy-requirements/for-branch/:branchId` returns every active
  requirement whose `childBranchType` matches the branch's own `branchType` and whose
  `parentBranchType` matches the branch's actual `parentBranch.branchType`. Returns `[]`
  (not an error) if the branch or its parent has no `branchType` configured.

## FR-HR-3 Submissions

- FR-HR-3.1 `POST /hierarchy-requirements/:id/submissions?branchId=` opens a new
  `HierarchyRequirementSubmission` cycle. Rejected with `400 BRANCH_TYPE_MISMATCH` unless
  the branch's type/parent-type actually match the requirement. Rejected with
  `409 SUBMISSION_ALREADY_EXISTS` if a submission for the same
  `(requirementId, branchId, periodLabel)` already exists — `periodLabel` defaults to `""`
  (a concrete empty string, not null) when omitted, for a one-off requirement.
- FR-HR-3.2 If the requirement has an `approvalWorkflowId`, creating a submission also
  calls `ApprovalWorkflowsService.startRequest` for it (idempotent, per Module 15).
- FR-HR-3.3 Creating a submission notifies every `User` holding one of the requirement's
  `notifyRoleNames` by email, via `NotificationsService.create` with an explicit
  `recipient` (the user's own email).
- FR-HR-3.4 `PATCH /hierarchy-requirements/submissions/:id/submit` moves a `pending`
  submission to `submitted`, recording `submittedByUserId`/`submittedAt` and optionally
  `attachedDocumentIds` (existing `Document` ids) and `notes`. Rejected with
  `400 SUBMISSION_ALREADY_SUBMITTED` if not currently `pending`.
- FR-HR-3.5 `GET /hierarchy-requirements/:id/submissions` — a requirement's full submission
  history across every branch (the parent's oversight view).
  `GET /hierarchy-requirements/submissions/branch/:branchId` — one branch's own submission
  history across every requirement (the child's own view).

## FR-HR-4 Approval

- FR-HR-4.1 `PATCH /hierarchy-requirements/submissions/:id/approve` and `.../reject`
  (both `@RequiresAuditReason()`) are rejected with `400 SUBMISSION_NOT_SUBMITTED` unless
  the submission is currently `submitted`.
- FR-HR-4.2 If the requirement has an `approvalWorkflowId`, the decision delegates to
  `ApprovalWorkflowsService.decide` (which enforces the calling user holds the current
  step's gating role/permission, per Module 15's FR-GOV-3.7). Otherwise the decision is
  recorded directly via `AuditService.record` (action
  `hierarchy_requirement_submission.approved`/`.rejected`).
- FR-HR-4.3 Either path updates the submission's own `status` to `approved`/`rejected`
  after the decision is recorded.

## FR-HR-5 Non-Functional

- FR-HR-5.1 `HierarchyRequirement`/`HierarchyRequirementSubmission` are added to the Prisma
  tenant-scoping extension's `TENANT_SCOPED_MODELS` set.
- FR-HR-5.2 New permission codes: `hierarchy_requirement.{create,read,update,delete}`,
  `hierarchy_requirement.submission.{create,read,submit,decide}`.
- FR-HR-5.3 `attachedDocumentIds` is a loose `String[]` of `Document.id`s, not a join
  table — consistent with the note in Module 15's docs about not building a relation table
  where a small array suffices.
