# API Design — Custom Fields

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Custom Field Definitions (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/custom-field-definitions` | `customfield.definition.create` | Define a new custom field on an entity type |
| GET | `/custom-field-definitions` | `customfield.definition.read` | List definitions (`?entityType=&includeInactive=`) |
| GET | `/custom-field-definitions/:id` | `customfield.definition.read` | Get one definition |
| PATCH | `/custom-field-definitions/:id` | `customfield.definition.update` | Update label/options/required/sort order |
| PATCH | `/custom-field-definitions/:id/deactivate` | `customfield.definition.delete` | Retire a field |
| PATCH | `/custom-field-definitions/:id/reactivate` | `customfield.definition.update` | Bring back a retired field |

There is no standalone `/custom-field-values` endpoint — values are only ever read/written
through the entity that owns them (e.g. `POST /members`, see below), since a value has no
meaning independent of the record it belongs to.

## Request/response shapes worth calling out

`POST /custom-field-definitions` (a `select` field):

```json
{
  "entityType": "member",
  "fieldKey": "spiritual_gift",
  "label": "Spiritual Gift",
  "fieldType": "select",
  "options": [
    { "key": "teaching", "label": "Teaching" },
    { "key": "worship", "label": "Worship" }
  ],
  "isRequired": false
}
```

## Member & Family Integration

`POST /members` / `PATCH /members/:id` (see
[../member-management/api-design.md](../member-management/api-design.md)) accept an optional
`customFields` object, keyed by `fieldKey`:

```json
{
  "branchId": "uuid",
  "firstName": "Jean",
  "lastName": "Uwimana",
  "customFields": {
    "confirmation_date": "2020-06-01",
    "spiritual_gift": "teaching"
  }
}
```

`GET /members/:id` and `GET /members` both include the same `customFields` shape on every
member in their response.

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `CUSTOM_FIELD_NOT_FOUND` | 404 | Definition doesn't exist in this tenant |
| `CUSTOM_FIELD_KEY_TAKEN` | 409 | `(entityType, fieldKey)` already defined |
| `CUSTOM_FIELD_OPTIONS_REQUIRED` | 400 | A `select` field was created/updated with no options |
| `CUSTOM_FIELD_UNKNOWN` | 400 | A value was submitted for a `fieldKey` with no active definition |
| `CUSTOM_FIELD_INVALID_VALUE` | 400 | A value doesn't match its field's declared type (or isn't a valid `select` option) |
| `CUSTOM_FIELD_REQUIRED` | 400 | A required custom field was missing when creating a record |
