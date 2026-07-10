# API Design — Member Registration

Base path: `/api/v1` (same envelope and tenant resolution contract as the Foundation
module — see [../api-design.md](../api-design.md)). New/changed endpoints on the existing
Members API (Module 2, [../member-management/api-design.md](../member-management/api-design.md)).

## New Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/members/register/branches` | Public (`@Public()`) | Minimal branch list for the registration picker |
| POST | `/members/register` | Public (`@Public()`, 5/min) | Self-register — always creates a `pending` member |
| PATCH | `/members/:id/approve` | `member.registration.decide` | Approve a pending registration (reason required) |
| PATCH | `/members/:id/reject` | `member.registration.decide` | Reject a pending registration (reason required) |

### Request/response shapes

`GET /members/register/branches` response (`data`, one item):

```json
{ "id": "uuid", "name": "Kigali Central Parish", "branchType": "parish", "parentBranchId": "uuid" }
```

`POST /members/register`:

```json
{
  "branchId": "uuid-of-a-branch",
  "firstName": "Jean",
  "lastName": "Uwimana",
  "phone": "+250780000000",
  "email": "jean@example.com"
}
```

`PATCH /members/:id/approve` / `.../reject`:

```json
{ "reason": "Documents verified in person." }
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `MEMBER_NOT_PENDING` | 400 | `approve`/`reject` was called on a member that isn't currently `pending` |

(`BRANCH_NOT_FOUND` is reused from the existing Members/Branches error set.)
