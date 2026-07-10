# Functional Requirements — Mandatory Audit Reasons + Deadlines (Named Hot-Spots)

## FR-AH-1 Member

- FR-AH-1.1 `PATCH /members/:id` rejects with a `422` field error unless `reason`
  (≥3 characters) is present whenever `membershipStatus` is included in the request body.
  `MembersService.update` writes to `AuditService` (action `member.status_changed`,
  `previousValue`/`newValue` capturing the status transition) only when
  `membershipStatus` is both present and different from the stored value.
- FR-AH-1.2 `DELETE /members/:id` (`@RequiresAuditReason()`) always requires `reason`;
  `MembersService.softDelete` writes to `AuditService` (action `member.deleted`) on every
  call.

## FR-AH-2 Visitor

- FR-AH-2.1 `PATCH /visitors/:id` rejects with a `422` field error unless `reason`
  (≥3 characters) is present whenever `status` is included in the request body.
  `VisitorsService.update` writes to `AuditService` (action `visitor.status_changed`)
  only when `status` is both present and different from the stored value.
- FR-AH-2.2 `PATCH /visitors/:id/convert` (`@RequiresAuditReason()`, `ConvertVisitorDto`
  extends `RequireReasonDto`) always requires `reason`; `VisitorsService.convertToMember`
  writes to `AuditService` (action `visitor.converted`) on every successful conversion.

## FR-AH-3 Hierarchy Requirement Deadlines

- FR-AH-3.1 `HierarchyRequirementsService.submit` calls
  `DeadlinesService.assertOpen(tenantId, "hierarchy_requirement_submission", submissionId)`
  before marking a submission `submitted`. A no-op when no `Deadline` row exists for that
  submission; otherwise rejects with `400 DEADLINE_NOT_OPEN` if the deadline is locked or
  closed.

## FR-AH-4 Non-Functional

- FR-AH-4.1 No new permission codes or migrations — this pass only adds conditional
  DTO validation, service-level `AuditService` calls, and one `DeadlinesService` call,
  reusing infrastructure that already existed from Module 15.
- FR-AH-4.2 `MembersModule`/`VisitorsModule` import `AuditModule` (already existed);
  `HierarchyRequirementsModule` additionally imports `DeadlinesModule` (already existed).
- FR-AH-4.3 Frontend: the Members admin page's remove action and the Visitors admin
  page's status-change/convert actions each prompt for a reason (≥3 characters,
  client-side check mirroring the server's) before calling the corresponding endpoint.
