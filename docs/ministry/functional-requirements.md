# Functional Requirements — Ministry & Volunteer Management

## FR-MIN-1 Ministries

- FR-MIN-1.1 A tenant can create a `Ministry` with a required `name` and optional `branchId`,
  `ministryType`, `description`.
- FR-MIN-1.2 If `branchId` is provided, it must reference an existing, non-deleted branch within
  the same tenant, or the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-MIN-1.3 `name` must be unique among a tenant's active ministries, or the request is
  rejected with `409 MINISTRY_NAME_TAKEN`.
- FR-MIN-1.4 `GET /ministries` returns a paginated, searchable (`search` matches `name`) list
  filterable by `branchId`/`ministryType`, following the Foundation module's standard query
  contract (FR-6.1). Soft-deleted ministries are always excluded.
- FR-MIN-1.5 `DELETE /ministries/:id` soft-deletes the ministry (`deletedAt`, `isActive=false`)
  and deactivates (`isActive=false`) every `MinistryMembership` under it — never a hard delete.

## FR-MIN-2 Ministry Memberships (Volunteers)

- FR-MIN-2.1 A tenant can create a `MinistryMembership` with required `ministryId`, `memberId`,
  and optional `role` (defaults to `"member"`) and `joinedAt` (defaults to now).
- FR-MIN-2.2 `ministryId` must reference an existing, non-deleted ministry within the same
  tenant, or the request is rejected with `404 MINISTRY_NOT_FOUND`.
- FR-MIN-2.3 `memberId` must reference an existing, non-deleted member within the same tenant,
  or the request is rejected with `404 MEMBER_NOT_FOUND`.
- FR-MIN-2.4 A member cannot have two membership records for the same ministry — a duplicate is
  rejected with `409 MINISTRY_MEMBERSHIP_ALREADY_EXISTS`.
- FR-MIN-2.5 `role` must be one of `leader`, `volunteer`, `member`. Multiple memberships with
  `role: "leader"` are permitted for the same ministry (co-leadership).
- FR-MIN-2.6 `GET /ministry-memberships` returns a paginated list filterable by
  `ministryId`/`memberId`/`role`.
- FR-MIN-2.7 `PATCH /ministry-memberships/:id` may update `role` and/or `isActive` only —
  `ministryId`/`memberId` are immutable; remove and re-add to move a membership between
  ministries.
- FR-MIN-2.8 `DELETE /ministry-memberships/:id` sets `isActive=false`; the row is never
  hard-deleted, preserving volunteer history.

## FR-MIN-3 Non-Functional

- FR-MIN-3.1 All ministry/membership mutations go through the same `@Permissions(...)` guard
  and tenant scoping as every other module — no new cross-cutting mechanism is introduced.
- FR-MIN-3.2 New permission codes introduced by this module: `ministry.create`, `ministry.read`,
  `ministry.update`, `ministry.delete`, `ministry.membership.create`,
  `ministry.membership.read`, `ministry.membership.update`, `ministry.membership.delete`.
- FR-MIN-3.3 `Ministry` and `MinistryMembership` are added to the Prisma tenant-scoping
  extension's `TENANT_SCOPED_MODELS` set, same as every other tenant-owned model.
