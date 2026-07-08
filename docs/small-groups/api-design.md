# API Design — Small Groups & Children's Ministry

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Small Groups (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/small-groups` | `small_group.create` | Create a small group (church-wide or scoped to a branch) |
| GET | `/small-groups` | `small_group.read` | Paginated list (`?branchId=&groupType=&search=`) |
| GET | `/small-groups/:id` | `small_group.read` | Get one small group |
| PATCH | `/small-groups/:id` | `small_group.update` | Update a small group |
| DELETE | `/small-groups/:id` | `small_group.delete` | Soft-delete a small group and deactivate its roster |

## Small Group Memberships (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/small-group-memberships` | `small_group.membership.create` | Add a member to a group |
| GET | `/small-group-memberships` | `small_group.membership.read` | Paginated list (`?smallGroupId=&memberId=&role=`) |
| GET | `/small-group-memberships/:id` | `small_group.membership.read` | Get one membership |
| PATCH | `/small-group-memberships/:id` | `small_group.membership.update` | Change `role`/`isActive` only |
| DELETE | `/small-group-memberships/:id` | `small_group.membership.delete` | Deactivate (keeps the row for history) |

## Request/response shapes worth calling out

`POST /small-groups` (a children's Sunday School class):

```json
{
  "name": "Sunday School — Ages 6-9",
  "groupType": "sunday_school",
  "meetingDay": "sunday",
  "meetingTime": "09:00",
  "location": "Children's Wing, Room 2",
  "capacity": 20,
  "minAge": 6,
  "maxAge": 9
}
```

`POST /small-groups` (a home group):

```json
{
  "name": "Kimironko Home Group",
  "groupType": "home_group",
  "meetingDay": "wednesday",
  "meetingTime": "18:30",
  "location": "Uwase residence, Kimironko",
  "capacity": 15
}
```

`POST /small-group-memberships`:

```json
{ "smallGroupId": "uuid", "memberId": "uuid", "role": "leader" }
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `SMALL_GROUP_NOT_FOUND` | 404 | Small group doesn't exist in this tenant |
| `SMALL_GROUP_NAME_TAKEN` | 409 | A group with this name already exists in the tenant |
| `SMALL_GROUP_INVALID_AGE_RANGE` | 400 | `minAge` is greater than `maxAge` |
| `SMALL_GROUP_FULL` | 409 | The group's capacity has been reached |
| `SMALL_GROUP_MEMBERSHIP_NOT_FOUND` | 404 | Membership doesn't exist in this tenant |
| `SMALL_GROUP_MEMBERSHIP_ALREADY_EXISTS` | 409 | This member already has a membership row for this group |
| `BRANCH_NOT_FOUND` | 404 | (Reused from Module 1) `branchId` doesn't resolve within the tenant |
| `MEMBER_NOT_FOUND` | 404 | (Reused from Module 2) `memberId` doesn't resolve within the tenant |
