# Functional Requirements — Small Groups & Children's Ministry

## FR-SG-1 Creating a Small Group

- FR-SG-1.1 A tenant can create a `SmallGroup` with required `name`, and optional `branchId`,
  `groupType`, `description`, `meetingDay`, `meetingTime`, `location`, `capacity`, `minAge`,
  `maxAge`.
- FR-SG-1.2 If `branchId` is provided, it must reference an existing, non-deleted branch
  within the same tenant, or the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-SG-1.3 `(tenantId, name)` must be unique — a duplicate is rejected with
  `409 SMALL_GROUP_NAME_TAKEN`.
- FR-SG-1.4 `meetingDay`, if provided, must be one of `monday`..`sunday`.
- FR-SG-1.5 `meetingTime`, if provided, must match 24-hour `HH:mm`.
- FR-SG-1.6 `capacity`, if provided, must be a positive integer.
- FR-SG-1.7 If both `minAge` and `maxAge` are provided, `minAge` must not exceed `maxAge`, or
  the request is rejected with `400 SMALL_GROUP_INVALID_AGE_RANGE`.

## FR-SG-2 Listing & Reading

- FR-SG-2.1 `GET /small-groups` returns a paginated list filterable by `branchId`,
  `groupType`, and `search` (matches `name`, case-insensitive). Soft-deleted groups are always
  excluded.
- FR-SG-2.2 `GET /small-groups/:id` returns one small group.

## FR-SG-3 Updating & Deleting

- FR-SG-3.1 `PATCH /small-groups/:id` may update any field except `id`/`tenantId`; changing
  `name` re-checks uniqueness; the age-range check (FR-SG-1.7) re-runs against the merged
  result of existing and updated values.
- FR-SG-3.2 `DELETE /small-groups/:id` soft-deletes the group (`deletedAt`, `isActive=false`)
  and deactivates every one of its memberships (`isActive: false`).

## FR-SG-4 Rosters

- FR-SG-4.1 A tenant can create a `SmallGroupMembership` with required `smallGroupId` and
  `memberId`, and optional `role` (default `"member"`), `joinedAt` (defaults to now).
- FR-SG-4.2 `smallGroupId` must reference an existing, non-deleted group within the same
  tenant, or the request is rejected with `404 SMALL_GROUP_NOT_FOUND`.
- FR-SG-4.3 `memberId` must reference an existing, non-deleted member within the same tenant,
  or the request is rejected with `404 MEMBER_NOT_FOUND`.
- FR-SG-4.4 A member cannot have two membership rows for the same group — a duplicate is
  rejected with `409 SMALL_GROUP_MEMBERSHIP_ALREADY_EXISTS`.
- FR-SG-4.5 If the group has a `capacity` set, a new membership is rejected with
  `409 SMALL_GROUP_FULL` once the number of active memberships reaches it.
- FR-SG-4.6 `GET /small-group-memberships` returns a paginated list filterable by
  `smallGroupId`, `memberId`, `role`.
- FR-SG-4.7 `PATCH /small-group-memberships/:id` may update `role` and/or `isActive` only —
  `smallGroupId`/`memberId` are immutable; remove and re-add to move a membership to a
  different group.
- FR-SG-4.8 `DELETE /small-group-memberships/:id` sets `isActive: false` — the row is never
  hard-deleted.

## FR-SG-5 Non-Functional

- FR-SG-5.1 All small group/membership mutations go through the same `@Permissions(...)`
  guard and tenant scoping as every other module.
- FR-SG-5.2 New permission codes: `small_group.create`, `small_group.read`,
  `small_group.update`, `small_group.delete`, `small_group.membership.create`,
  `small_group.membership.read`, `small_group.membership.update`,
  `small_group.membership.delete`.
- FR-SG-5.3 `SmallGroup` and `SmallGroupMembership` are added to the Prisma tenant-scoping
  extension's `TENANT_SCOPED_MODELS` set.
- FR-SG-5.4 New `ConfigItem` namespace: `small_group_type`.
