# API Design — Ministry & Volunteer Management

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Ministries (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/ministries` | `ministry.create` | Create a ministry (church-wide or scoped to a branch) |
| GET | `/ministries` | `ministry.read` | Paginated/searchable list (`?branchId=&ministryType=&search=`) |
| GET | `/ministries/:id` | `ministry.read` | Get one ministry |
| PATCH | `/ministries/:id` | `ministry.update` | Update a ministry |
| DELETE | `/ministries/:id` | `ministry.delete` | Soft-delete a ministry and deactivate its memberships |

## Ministry Memberships / Volunteers (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/ministry-memberships` | `ministry.membership.create` | Add a member to a ministry with a role |
| GET | `/ministry-memberships` | `ministry.membership.read` | Paginated list (`?ministryId=&memberId=&role=`) |
| GET | `/ministry-memberships/:id` | `ministry.membership.read` | Get one membership |
| PATCH | `/ministry-memberships/:id` | `ministry.membership.update` | Change `role`/`isActive` only |
| DELETE | `/ministry-memberships/:id` | `ministry.membership.delete` | Deactivate a membership (keeps volunteer history) |

## Request/response shapes worth calling out

`POST /ministries`:

```json
{
  "name": "Youth Ministry",
  "branchId": "uuid",
  "ministryType": "youth",
  "description": "Ages 13-25, meets Friday evenings"
}
```

`POST /ministry-memberships`:

```json
{
  "ministryId": "uuid",
  "memberId": "uuid",
  "role": "leader",
  "joinedAt": "2026-01-15"
}
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `MINISTRY_NOT_FOUND` | 404 | Ministry doesn't exist in this tenant |
| `MINISTRY_NAME_TAKEN` | 409 | Another active ministry already has this name |
| `MINISTRY_MEMBERSHIP_NOT_FOUND` | 404 | Membership record doesn't exist in this tenant |
| `MINISTRY_MEMBERSHIP_ALREADY_EXISTS` | 409 | This member already has a membership record for this ministry |
| `BRANCH_NOT_FOUND` | 404 | (Reused from Module 1) `branchId` doesn't resolve within the tenant |
| `MEMBER_NOT_FOUND` | 404 | (Reused from Module 2) `memberId` doesn't resolve within the tenant |
