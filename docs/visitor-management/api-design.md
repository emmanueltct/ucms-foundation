# API Design — Visitor & Follow-up Management

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Visitors (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/visitors` | `visitor.create` | Record a first-time visitor |
| GET | `/visitors` | `visitor.read` | Paginated list (`?branchId=&status=&assignedToUserId=&search=`) |
| GET | `/visitors/:id` | `visitor.read` | Get one visitor |
| PATCH | `/visitors/:id` | `visitor.update` | Update a visitor (any status except `joined`) |
| DELETE | `/visitors/:id` | `visitor.delete` | Soft-delete a visitor |
| PATCH | `/visitors/:id/convert` | `visitor.convert` | Link to a member and mark `joined` |
| POST | `/visitors/:id/follow-ups` | `visitor.followup.create` | Log a follow-up interaction |
| GET | `/visitors/:id/follow-ups` | `visitor.followup.read` | List follow-up history, most recent first |

## Request/response shapes worth calling out

`POST /visitors`:

```json
{
  "firstName": "Alice",
  "lastName": "Uwase",
  "phone": "+250780000002",
  "visitDate": "2026-07-05",
  "source": "friend_family",
  "invitedByMemberId": "uuid",
  "assignedToUserId": "uuid"
}
```

`PATCH /visitors/:id/convert`:

```json
{ "memberId": "uuid" }
```

`POST /visitors/:id/follow-ups`:

```json
{ "method": "call", "outcome": "Left a voicemail, will try again Thursday." }
```

Response (`data`) for a follow-up entry:

```json
{
  "id": "uuid",
  "visitorId": "uuid",
  "method": "call",
  "followUpDate": "2026-07-08T10:00:00.000Z",
  "outcome": "Left a voicemail, will try again Thursday.",
  "performedByUserId": "uuid",
  "createdAt": "2026-07-08T10:00:00.000Z"
}
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `VISITOR_NOT_FOUND` | 404 | Visitor doesn't exist in this tenant |
| `VISITOR_USE_CONVERT_ENDPOINT` | 400 | `PATCH /visitors/:id` was used to set `status: "joined"` directly |
| `VISITOR_ALREADY_CONVERTED` | 400 | This visitor already has a linked member |
| `MEMBER_ALREADY_LINKED_TO_VISITOR` | 409 | The target member is already linked to a different visitor |
| `BRANCH_NOT_FOUND` | 404 | (Reused from Module 1) `branchId` doesn't resolve within the tenant |
| `MEMBER_NOT_FOUND` | 404 | (Reused from Module 2) `invitedByMemberId`/`memberId` doesn't resolve within the tenant |
