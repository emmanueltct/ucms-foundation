# API Design — Governance (Audit, Approval Workflows & Deadlines)

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Approval Workflows (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/approval-workflows` | `approval_workflow.create` | Define an ordered approval chain for an entityType |
| GET | `/approval-workflows` | `approval_workflow.read` | List workflows (`?entityType=`) |
| GET | `/approval-workflows/requests/:entityType/:entityId` | `approval_workflow.read` | Get one entity's current approval request |
| PATCH | `/approval-workflows/requests/:entityType/:entityId/approve` | `approval_workflow.decide` | Approve the current step (reason required) |
| PATCH | `/approval-workflows/requests/:entityType/:entityId/reject` | `approval_workflow.decide` | Reject the request (reason required) |
| GET | `/approval-workflows/:id` | `approval_workflow.read` | Get one workflow |
| PATCH | `/approval-workflows/:id` | `approval_workflow.update` | Rename / activate / deactivate |

Note the `requests/...` routes are declared before `:id` in the controller — the same
literal-prefix-before-catch-all ordering this project has used since Reports/Members'
`export` vs. `:id` routes.

### Request/response shapes

`POST /approval-workflows`:

```json
{
  "entityType": "member_registration",
  "name": "Standard member approval",
  "steps": [
    { "label": "Branch leader review", "approverRoleName": "branch_leader" },
    { "label": "District sign-off", "approverPermissionCode": "member.approve" }
  ]
}
```

`PATCH .../approve` / `.../reject`:

```json
{ "reason": "All documents verified in person." }
```

`GET /approval-workflows/requests/:entityType/:entityId` response (`data`):

```json
{
  "id": "uuid",
  "workflowId": "uuid",
  "entityType": "member_registration",
  "entityId": "uuid",
  "currentStepOrder": 2,
  "status": "pending",
  "workflow": {
    "id": "uuid",
    "name": "Standard member approval",
    "steps": [
      { "stepOrder": 1, "label": "Branch leader review", "approverRoleName": "branch_leader" },
      { "stepOrder": 2, "label": "District sign-off", "approverPermissionCode": "member.approve" }
    ]
  }
}
```

## Deadlines (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/deadlines` | `deadline.create` | Set a deadline against any (entityType, entityId) |
| GET | `/deadlines/:entityType/:entityId` | `deadline.read` | Get a deadline, including derived `effectiveStatus` |
| PATCH | `/deadlines/:entityType/:entityId/extend` | `deadline.extend` | Push a locked deadline forward (reason required) |
| PATCH | `/deadlines/:entityType/:entityId/close` | `deadline.close` | Close a deadline (reason required) |
| PATCH | `/deadlines/:entityType/:entityId/reopen` | `deadline.reopen` | Reopen a closed deadline (reason required) |

### Request/response shapes

`POST /deadlines`:

```json
{ "entityType": "hierarchy_requirement_submission", "entityId": "uuid", "dueAt": "2026-08-05T00:00:00.000Z" }
```

`PATCH .../extend`:

```json
{ "dueAt": "2026-08-12T00:00:00.000Z", "reason": "District office was closed for the holiday." }
```

`GET /deadlines/:entityType/:entityId` response (`data`):

```json
{
  "id": "uuid",
  "entityType": "hierarchy_requirement_submission",
  "entityId": "uuid",
  "dueAt": "2026-08-05T00:00:00.000Z",
  "status": "open",
  "effectiveStatus": "locked",
  "extendedByUserId": null,
  "extensionReason": null,
  "closedAt": null
}
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `AUDIT_REASON_REQUIRED` | 400 | A route marked `@RequiresAuditReason()` was called without a `reason` of at least 3 characters |
| `APPROVAL_WORKFLOW_NOT_FOUND` | 404 | Workflow doesn't exist in this tenant |
| `APPROVAL_REQUEST_NOT_FOUND` | 404 | No approval request exists for this `(entityType, entityId)` |
| `APPROVAL_REQUEST_ALREADY_DECIDED` | 400 | The request was already approved or rejected |
| `APPROVAL_STEP_FORBIDDEN` | 403 | The caller doesn't hold the current step's gating role/permission |
| `DEADLINE_NOT_FOUND` | 404 | No deadline exists for this `(entityType, entityId)` |
| `DEADLINE_NOT_LOCKED` | 400 | `extend` was called on a deadline that isn't currently locked |
| `DEADLINE_ALREADY_CLOSED` | 400 | `close` was called on an already-closed deadline |
| `DEADLINE_NOT_CLOSED` | 400 | `reopen` was called on a deadline that isn't closed |
| `DEADLINE_NOT_OPEN` | 400 | A consuming module's edit/submit action was blocked by `assertOpen` — the deadline is locked or closed |
