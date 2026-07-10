# API Design — Dynamic Modules

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Module Definitions (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/dynamic-modules` | `dynamic_module.manage` | Define a new module |
| GET | `/dynamic-modules` | `dynamic_module.read` | List modules (`?showInNav=true`) |
| GET | `/dynamic-modules/by-key/:key` | `dynamic_module.read` | Get one module by its stable key |
| GET | `/dynamic-modules/:id` | `dynamic_module.read` | Get one module |
| PATCH | `/dynamic-modules/:id` | `dynamic_module.manage` | Update a module (key is immutable) |
| DELETE | `/dynamic-modules/:id` | `dynamic_module.manage` | Soft-delete a module |

## Records (tenant-scoped, dynamically permissioned)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/dynamic-modules/:moduleDefinitionId/records` | `dynamicmodule.{id}.create` | Create a record |
| GET | `/dynamic-modules/:moduleDefinitionId/records` | `dynamicmodule.{id}.read` | List records |
| GET | `/dynamic-modules/:moduleDefinitionId/records/summary` | `dynamicmodule.{id}.read` | Counts by status/branch |
| PATCH | `/dynamic-modules/:moduleDefinitionId/records/:id/status` | `dynamicmodule.{id}.approve` | Change status (reason required) |
| GET | `/dynamic-modules/:moduleDefinitionId/records/:id/status-history` | `dynamicmodule.{id}.read` | Status timeline |
| GET | `/dynamic-modules/:moduleDefinitionId/records/:id` | `dynamicmodule.{id}.read` | Get one record |
| PATCH | `/dynamic-modules/:moduleDefinitionId/records/:id` | `dynamicmodule.{id}.update` | Update title/branch/fields |
| DELETE | `/dynamic-modules/:moduleDefinitionId/records/:id` | `dynamicmodule.{id}.delete` | Soft-delete |

`summary` is declared before the plain `:id` route — the same literal-prefix-before-catch-all
ordering used throughout this project.

### Request/response shapes

`POST /dynamic-modules`:

```json
{
  "key": "committee-requests",
  "label": "Committee Requests",
  "statuses": ["open", "in_review", "approved", "rejected"],
  "attachableToEntityTypes": ["branch", "ministry"],
  "showInNav": true
}
```

`POST /dynamic-modules/:moduleDefinitionId/records`:

```json
{
  "title": "New sound system for the youth hall",
  "attachedToEntityType": "branch",
  "attachedToEntityId": "uuid-of-a-branch",
  "customFields": { "estimated_cost": 450000, "requested_by": "Youth Ministry" }
}
```

`PATCH .../records/:id/status`:

```json
{ "toStatus": "approved", "reason": "Budget confirmed with Finance." }
```

`GET .../records/:id` response (`data`):

```json
{
  "id": "uuid",
  "moduleDefinitionId": "uuid",
  "attachedToEntityType": "branch",
  "attachedToEntityId": "uuid",
  "status": "open",
  "title": "New sound system for the youth hall",
  "branchId": "uuid",
  "customFields": { "estimated_cost": 450000, "requested_by": "Youth Ministry" }
}
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `DYNAMIC_MODULE_KEY_TAKEN` | 409 | A module with this `key` already exists in the tenant |
| `DYNAMIC_MODULE_NOT_FOUND` | 404 | Module definition doesn't exist in this tenant |
| `DYNAMIC_MODULE_STATUSES_REQUIRED` | 400 | `PATCH` tried to set `statuses` to an empty array |
| `DYNAMIC_MODULE_RECORD_NOT_FOUND` | 404 | Record doesn't exist in this tenant/module |
| `DYNAMIC_MODULE_INVALID_STATUS` | 400 | `toStatus` isn't one of the module's configured statuses |
| `DYNAMIC_MODULE_STATUS_UNCHANGED` | 400 | The record already has the requested status |
| `PERMISSION_FORBIDDEN` | 403 | Caller lacks the generated `dynamicmodule.{id}.{action}` code for a record-level action |
