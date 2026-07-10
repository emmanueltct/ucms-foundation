# Functional Requirements — Member Registration

## FR-MR-1 Public Self-Registration

- FR-MR-1.1 `GET /members/register/branches` (`@Public()`) returns every active branch in
  the tenant as `{id, name, branchType, parentBranchId}` — a minimal projection for the
  registration form's picker, not the full `Branch` shape `GET /branches` returns.
- FR-MR-1.2 `POST /members/register` (`@Public()`, rate-limited 5/min) creates a `Member`
  with `branchId`, `firstName`, `lastName`, and optionally `gender`, `dateOfBirth`,
  `phone`, `email`, `address`, `customFields`. `membershipStatus` is always `"pending"` —
  there is no field on `RegisterMemberDto` to override it.
- FR-MR-1.3 Rejected with `404 BRANCH_NOT_FOUND` if `branchId` doesn't resolve within the
  tenant. Required custom fields (if any are defined for `entityType: "member"`) are
  validated the same as admin-created members.

## FR-MR-2 Approval

- FR-MR-2.1 `PATCH /members/:id/approve` and `PATCH /members/:id/reject`
  (`member.registration.decide`, both `@RequiresAuditReason()`) are rejected with
  `400 MEMBER_NOT_PENDING` unless the member's current `membershipStatus` is `"pending"`.
- FR-MR-2.2 If an active `ApprovalWorkflow` exists for `entityType: "member_registration"`
  in the tenant, the decision is routed through `ApprovalWorkflowsService.startRequest` +
  `.decide` (enforcing the current step's gating role/permission per Module 15's
  FR-GOV-3.7). Otherwise the decision is recorded directly via `AuditService.record`
  (action `member.registration.approved`/`.rejected`).
- FR-MR-2.3 Either path sets `membershipStatus` to `"active"` (approve) or `"rejected"`
  (reject) immediately after the decision is recorded.

## FR-MR-3 Non-Functional

- FR-MR-3.1 `Member.membershipStatus`'s validated set (`CreateMemberDto`,
  `UpdateMemberDto`, `MemberQueryDto`) gains `"pending"` and `"rejected"` alongside the
  existing `active`/`inactive`/`transferred`/`deceased` — no schema/migration change,
  since the column was always a plain `String`.
- FR-MR-3.2 New permission code: `member.registration.decide`.
- FR-MR-3.3 `MembersModule` imports `AuditModule` and `ApprovalWorkflowsModule` (both
  already existed from Module 15/Phase 0) so `MembersService` can inject
  `AuditService`/`ApprovalWorkflowsService`.
