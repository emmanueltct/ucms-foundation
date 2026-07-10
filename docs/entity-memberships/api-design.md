# API Design — Entity Memberships

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Entity Memberships (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/entity-memberships` | `entity_membership.create` | Add an existing member to an entity with a role |
| GET | `/entity-memberships` | `entity_membership.read` | List memberships (paginated; `?attachedToEntityType=&attachedToEntityId=&memberId=&role=`) |
| GET | `/entity-memberships/:id` | `entity_membership.read` | Get one membership |
| PATCH | `/entity-memberships/:id` | `entity_membership.update` | Change role and/or active status |
| DELETE | `/entity-memberships/:id` | `entity_membership.delete` | Deactivate (never hard-deletes) |

### Request/response shapes

`POST /entity-memberships`:

```json
{
  "attachedToEntityType": "dynamicmodule:uuid-of-a-module-definition",
  "attachedToEntityId": "uuid-of-a-record",
  "memberId": "uuid-of-a-member",
  "role": "leader"
}
```

`GET /entity-memberships?attachedToEntityType=...&attachedToEntityId=...` response (`data`,
one item):

```json
{
  "id": "uuid",
  "attachedToEntityType": "dynamicmodule:uuid-of-a-module-definition",
  "attachedToEntityId": "uuid-of-a-record",
  "memberId": "uuid-of-a-member",
  "role": "leader",
  "joinedAt": "2026-07-10T00:00:00.000Z",
  "isActive": true
}
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `ENTITY_MEMBERSHIP_NOT_FOUND` | 404 | Membership doesn't exist in this tenant |
| `ENTITY_MEMBERSHIP_TARGET_NOT_FOUND` | 404 | The `dynamicmodule:` entity being joined doesn't exist |
| `ENTITY_MEMBERSHIP_ALREADY_EXISTS` | 409 | This member already has a membership for this entity |
| `MEMBER_NOT_FOUND` | 404 | `memberId` doesn't resolve to an existing member in this tenant |
