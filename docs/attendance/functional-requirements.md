# Functional Requirements — Attendance

## FR-ATT-1 Recording Attendance

- FR-ATT-1.1 A tenant can create an `AttendanceRecord` with required `branchId`, `serviceType`,
  `attendedAt`, and optional `memberId`, `attendanceMethod`, `headcount`, `notes`.
- FR-ATT-1.2 `branchId` must reference an existing, non-deleted branch within the same tenant,
  or the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-ATT-1.3 If provided, `memberId` must reference an existing, non-deleted member within the
  same tenant, or the request is rejected with `404 MEMBER_NOT_FOUND`.
- FR-ATT-1.4 If `memberId` is provided, `headcount` is always forced to `1` regardless of any
  value supplied by the client.
- FR-ATT-1.5 If `memberId` is omitted, `headcount` is required and must be a positive integer,
  or the request is rejected with `400 ATTENDANCE_HEADCOUNT_REQUIRED`.
- FR-ATT-1.6 A named member (`memberId` set) cannot have two active records for the same
  `branchId` + `serviceType` + `attendedAt` — a duplicate is rejected with
  `409 ATTENDANCE_ALREADY_RECORDED`. This check does not apply when `memberId` is omitted.
- FR-ATT-1.7 `recordedByUserId` is set from the authenticated user making the request; it is
  not an accepted input field.

## FR-ATT-2 Listing & Reading

- FR-ATT-2.1 `GET /attendance-records` returns a paginated list filterable by `branchId`,
  `memberId`, `serviceType`, and `dateFrom`/`dateTo` (on `attendedAt`), following the
  Foundation module's standard query contract (FR-6.1). Soft-deleted records are always
  excluded.
- FR-ATT-2.2 `GET /attendance-records/:id` returns one record.
- FR-ATT-2.3 `GET /attendance-records/summary` returns totals (`SUM(headcount)` as
  `totalAttendance`, plus a raw `recordCount`) grouped by `serviceType`, filtered by the same
  `branchId`/`dateFrom`/`dateTo` parameters as the list endpoint.

## FR-ATT-3 Correcting a Record

- FR-ATT-3.1 `PATCH /attendance-records/:id` may update any of `branchId`, `memberId`,
  `serviceType`, `attendanceMethod`, `headcount`, `attendedAt`, `notes` — unlike Finance, there
  is no field-level lock, since no field here carries Finance's audit-trail sensitivity.
- FR-ATT-3.2 Changing any of `branchId`/`memberId`/`serviceType`/`attendedAt` re-validates the
  new branch/member (if changed) and re-checks the FR-ATT-1.6 uniqueness rule against the
  *new* combination, excluding the record being updated.
- FR-ATT-3.3 Changing `memberId` (to set or clear it) re-applies the FR-ATT-1.4/1.5 headcount
  rule for the new value.

## FR-ATT-4 Deleting a Record

- FR-ATT-4.1 `DELETE /attendance-records/:id` soft-deletes the record (`deletedAt`,
  `isActive=false`) — never a hard delete, per the Foundation module's standing rule.

## FR-ATT-5 Non-Functional

- FR-ATT-5.1 All attendance mutations go through the same `@Permissions(...)` guard and tenant
  scoping as every other module — no new cross-cutting mechanism is introduced.
- FR-ATT-5.2 New permission codes introduced by this module: `attendance.record.create`,
  `attendance.record.read`, `attendance.record.update`, `attendance.record.delete`.
- FR-ATT-5.3 `AttendanceRecord` is added to the Prisma tenant-scoping extension's
  `TENANT_SCOPED_MODELS` set, same as `Branch`/`Member`/`Family`/`Contribution`.
