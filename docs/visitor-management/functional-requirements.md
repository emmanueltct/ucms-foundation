# Functional Requirements — Visitor & Follow-up Management

## FR-VIS-1 Recording a Visitor

- FR-VIS-1.1 A tenant can create a `Visitor` with required `firstName`, `lastName`,
  `visitDate`, and optional `branchId`, `phone`, `email`, `address`, `source`,
  `invitedByMemberId`, `assignedToUserId`, `notes`. `status` always starts `"new"`.
- FR-VIS-1.2 If `branchId` is provided, it must reference an existing, non-deleted branch
  within the same tenant, or the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-VIS-1.3 If `invitedByMemberId` is provided, it must reference an existing, non-deleted
  member within the same tenant, or the request is rejected with `404 MEMBER_NOT_FOUND`.

## FR-VIS-2 Listing & Reading

- FR-VIS-2.1 `GET /visitors` returns a paginated list filterable by `branchId`, `status`,
  `assignedToUserId`, and `search` (matches first name, last name, phone, or email,
  case-insensitive). Soft-deleted visitors are always excluded.
- FR-VIS-2.2 `GET /visitors/:id` returns one visitor.

## FR-VIS-3 Updating & Deleting

- FR-VIS-3.1 `PATCH /visitors/:id` may update any field except `id`/`tenantId`. `status` may
  be set to any value except `"joined"`, which is rejected with
  `400 VISITOR_USE_CONVERT_ENDPOINT` (see FR-VIS-4).
- FR-VIS-3.2 `DELETE /visitors/:id` soft-deletes the visitor (`deletedAt`, `isActive=false`).

## FR-VIS-4 Converting to a Member

- FR-VIS-4.1 `PATCH /visitors/:id/convert` accepts a required `memberId`, which must
  reference an existing, non-deleted member within the same tenant
  (`404 MEMBER_NOT_FOUND` otherwise).
- FR-VIS-4.2 If the visitor has already been converted (`convertedMemberId` already set), the
  request is rejected with `400 VISITOR_ALREADY_CONVERTED`.
- FR-VIS-4.3 If the target member is already linked to a different visitor, the request is
  rejected with `409 MEMBER_ALREADY_LINKED_TO_VISITOR`.
- FR-VIS-4.4 On success, `status` is set to `"joined"` and `convertedMemberId` is set to the
  given `memberId`, in one update.

## FR-VIS-5 Follow-up Interactions

- FR-VIS-5.1 `POST /visitors/:id/follow-ups` creates a `VisitorFollowUp` with required
  `method`, and optional `followUpDate` (defaults to now) and `outcome`. `performedByUserId`
  is set from the authenticated caller, not client-supplied.
- FR-VIS-5.2 `GET /visitors/:id/follow-ups` returns the visitor's full follow-up history,
  most recent first. There is no update or delete endpoint — a logged follow-up is permanent
  history (see business analysis).

## FR-VIS-6 Non-Functional

- FR-VIS-6.1 All visitor/follow-up mutations go through the same `@Permissions(...)` guard
  and tenant scoping as every other module.
- FR-VIS-6.2 New permission codes: `visitor.create`, `visitor.read`, `visitor.update`,
  `visitor.delete`, `visitor.convert`, `visitor.followup.create`, `visitor.followup.read`.
- FR-VIS-6.3 `Visitor` and `VisitorFollowUp` are added to the Prisma tenant-scoping
  extension's `TENANT_SCOPED_MODELS` set.
- FR-VIS-6.4 New `ConfigItem` namespaces: `visitor_source`, `follow_up_method`.
