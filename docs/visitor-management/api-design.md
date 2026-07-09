# API Design — Visitor & Follow-up Management

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Visitors (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/visitors` | `visitor.create` | Record a first-time visitor (optionally linked to a `VisitorGroup`) |
| GET | `/visitors` | `visitor.read` | Paginated list (`?branchId=&visitorGroupId=&status=&assignedToUserId=&search=`) |
| GET | `/visitors/:id` | `visitor.read` | Get one visitor |
| PATCH | `/visitors/:id` | `visitor.update` | Update a visitor (any status except `joined`) |
| DELETE | `/visitors/:id` | `visitor.delete` | Soft-delete a visitor |
| PATCH | `/visitors/:id/convert` | `visitor.convert` | Link to a member and mark `joined` |
| POST | `/visitors/:id/activities` | `visitor.activity.create` | Log a configurable activity against this visitor |
| GET | `/visitors/:id/activities` | `visitor.activity.read` | List activity history, most recent first |

## Visitor Groups (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/visitor-groups` | `visitor_group.create` | Record a visiting group (family, delegation, choir/youth visit, conference party, mission team, ...) |
| GET | `/visitor-groups` | `visitor_group.read` | Paginated list (`?branchId=&groupType=&status=&search=`) |
| GET | `/visitor-groups/:id` | `visitor_group.read` | Get one group |
| PATCH | `/visitor-groups/:id` | `visitor_group.update` | Update a group |
| DELETE | `/visitor-groups/:id` | `visitor_group.delete` | Soft-delete a group (members are unaffected) |
| GET | `/visitor-groups/:id/members` | `visitor_group.read` | List the individual `Visitor`s recorded as members of this group |
| POST | `/visitor-groups/:id/activities` | `visitor.activity.create` | Log a configurable activity against the whole group |
| GET | `/visitor-groups/:id/activities` | `visitor.activity.read` | List the group's activity history, most recent first |

## Request/response shapes worth calling out

`POST /visitors`:

```json
{
  "firstName": "Alice",
  "lastName": "Uwase",
  "phone": "+250780000002",
  "visitDate": "2026-07-05",
  "source": "friend_family",
  "visitorGroupId": "uuid",
  "invitedByMemberId": "uuid",
  "assignedToUserId": "uuid"
}
```

`PATCH /visitors/:id/convert`:

```json
{ "memberId": "uuid" }
```

`POST /visitor-groups`:

```json
{
  "name": "Kigali Baptist Youth Choir",
  "groupType": "choir_visit",
  "visitDate": "2026-07-12",
  "contactName": "Pastor Jean",
  "contactPhone": "+250780000099",
  "expectedSize": 25
}
```

`POST /visitors/:id/activities` and `POST /visitor-groups/:id/activities` (identical shape —
the only difference is which record the activity attaches to):

```json
{
  "activityType": "baptism_class",
  "outcome": "Completed all four sessions.",
  "customFields": { "class_completed": true, "certificate_number": "BC-0042" }
}
```

`customFields` is validated against `GET /custom-field-definitions?entityType=visitor_activity:baptism_class`
— see [../custom-fields/api-design.md](../custom-fields/api-design.md). Response (`data`) for
an activity entry:

```json
{
  "id": "uuid",
  "visitorId": "uuid",
  "visitorGroupId": null,
  "activityType": "baptism_class",
  "activityDate": "2026-07-08T10:00:00.000Z",
  "outcome": "Completed all four sessions.",
  "notes": null,
  "performedByUserId": "uuid",
  "createdAt": "2026-07-08T10:00:00.000Z",
  "customFields": { "class_completed": true, "certificate_number": "BC-0042" }
}
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `VISITOR_NOT_FOUND` | 404 | Visitor doesn't exist in this tenant |
| `VISITOR_GROUP_NOT_FOUND` | 404 | Visitor group doesn't exist in this tenant |
| `VISITOR_USE_CONVERT_ENDPOINT` | 400 | `PATCH /visitors/:id` was used to set `status: "joined"` directly |
| `VISITOR_ALREADY_CONVERTED` | 400 | This visitor already has a linked member |
| `MEMBER_ALREADY_LINKED_TO_VISITOR` | 409 | The target member is already linked to a different visitor |
| `VISITOR_ACTIVITY_TARGET_INVALID` | 400 | An activity was created targeting neither or both of a visitor/visitor group |
| `BRANCH_NOT_FOUND` | 404 | (Reused from Module 1) `branchId` doesn't resolve within the tenant |
| `MEMBER_NOT_FOUND` | 404 | (Reused from Module 2) `invitedByMemberId`/`memberId` doesn't resolve within the tenant |
| `CUSTOM_FIELD_REQUIRED` / `CUSTOM_FIELD_UNKNOWN` / `CUSTOM_FIELD_INVALID_VALUE` | 400 | (Reused from Module 9) `customFields` failed validation for this `activityType` |
