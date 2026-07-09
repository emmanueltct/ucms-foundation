# Functional Requirements — Member Activities & Personal History

## FR-MA-1 Logging an Activity

- FR-MA-1.1 `POST /members/:id/activities` creates a `MemberActivity` with required
  `activityType` (a `ConfigItem` key in namespace `member_activity_type`), and optional
  `activityDate` (defaults to now), `outcome`, `notes`, and `customFields`.
  `performedByUserId` is set from the authenticated caller, not client-supplied.
- FR-MA-1.2 If `id` doesn't resolve to an existing, non-deleted member within the tenant, the
  request is rejected with `404 MEMBER_NOT_FOUND`.
- FR-MA-1.3 `customFields` is validated against this tenant's Custom Fields definitions for
  entityType `member_activity:{activityType}` (required-field and per-type validation reused
  from the Custom Fields module), the same composition Assets and Visitor Activities use.

## FR-MA-2 Listing an Activity History

- FR-MA-2.1 `GET /members/:id/activities` returns the full activity log for that member, most
  recent first, each with its `customFields` attached. There is no update or delete endpoint —
  a logged activity is permanent history.

## FR-MA-3 Aggregated Activity History Report

- FR-MA-3.1 `GET /reports/members/:id/activity-history` returns, for one member:
  - `member`: `{ id, firstName, lastName, membershipNumber }`
  - `ministries`: every `MinistryMembership` for this member, with the ministry's name
  - `smallGroups`: every `SmallGroupMembership` for this member, with the group's name
  - `eventsAttended`: every `EventRegistration` for this member, with the event's name/date
  - `attendance`: `{ totalCount, recent }` — `recent` is the 50 most recent
    `AttendanceRecord`s; `totalCount` is computed over the full (unfiltered) history
  - `contributions`: `{ totalAmount, totalCount, recent }` — same 50-row cap on `recent`,
    non-voided contributions only
  - `activities`: every `MemberActivity` for this member (same data as FR-MA-2.1)
  - `timeline`: all of the above merged into one list of `{ kind, date, label, detail }`
    entries, sorted by `date` descending
- FR-MA-3.2 If `id` doesn't resolve to an existing, non-deleted member within the tenant, the
  request is rejected with `404 MEMBER_NOT_FOUND`.
- FR-MA-3.3 This endpoint introduces no new Prisma queries beyond plain reads of existing
  tenant-scoped tables (plus the new `MemberActivity`) — no new permission codes are needed
  for the read side of ministries/small groups/events/attendance/contributions since this
  report is gated by the pre-existing `reports.view` permission, the same gate every other
  cross-module report in this module uses.

## FR-MA-4 Non-Functional

- FR-MA-4.1 All `MemberActivity` mutations go through the same `@Permissions(...)` guard and
  tenant scoping as every other module.
- FR-MA-4.2 New permission codes: `member.activity.create`, `member.activity.read`.
  `reports.view` (pre-existing) gates FR-MA-3.
- FR-MA-4.3 `MemberActivity` is added to the Prisma tenant-scoping extension's
  `TENANT_SCOPED_MODELS` set.
- FR-MA-4.4 New `ConfigItem` namespace: `member_activity_type`.
