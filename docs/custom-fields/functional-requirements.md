# Functional Requirements — Custom Fields

## FR-CF-1 Defining a Custom Field

- FR-CF-1.1 A tenant can create a `CustomFieldDefinition` with required `entityType`, `fieldKey`,
  `label`, `fieldType` (`text` | `number` | `date` | `boolean` | `select` | `file`), and optional
  `options`, `isRequired`, `sortOrder`.
- FR-CF-1.2 `options` is required (non-empty) when `fieldType` is `select`, or the request is
  rejected with `400 CUSTOM_FIELD_OPTIONS_REQUIRED`.
- FR-CF-1.3 `(tenantId, entityType, fieldKey)` must be unique — a duplicate is rejected with
  `409 CUSTOM_FIELD_KEY_TAKEN`.
- FR-CF-1.4 `entityType`, `fieldKey`, and `fieldType` cannot be changed after creation — `PATCH`
  only accepts `label`, `options`, `isRequired`, `sortOrder`, `isActive`.
- FR-CF-1.5 `PATCH /custom-field-definitions/:id/deactivate` and `.../reactivate` soft-toggle
  `isActive` — there is no hard-delete endpoint, mirroring `ConfigItem`.

## FR-CF-2 Reading Definitions

- FR-CF-2.1 `GET /custom-field-definitions` returns definitions filterable by `entityType`,
  excluding inactive ones by default (`includeInactive=true` to include them), ordered by
  `entityType`, then `sortOrder`, then `label`.

## FR-CF-3 Values (consumed by integrating modules, not a public sub-resource of its own)

- FR-CF-3.1 A value is validated against its field's declared `fieldType` before being
  persisted: `text` must be a string, `number` a number, `boolean` a boolean, `date` a string
  that parses, `select` one of the definition's option keys, `file` an object shaped
  `{ key, filename }` (the storage reference an uploading module writes after a successful
  upload — this module never handles the binary itself). An invalid value is rejected with
  `400 CUSTOM_FIELD_INVALID_VALUE`.
- FR-CF-3.2 Setting a value for a `fieldKey` with no matching active definition for that
  `entityType` is rejected with `400 CUSTOM_FIELD_UNKNOWN`.
- FR-CF-3.3 `null`/`undefined` values are accepted without a type check — clearing an optional
  field is always valid.
- FR-CF-3.4 An integrating module's `create` flow must call `assertRequiredFieldsProvided`
  *before* persisting the parent record — a missing required custom field is rejected with
  `400 CUSTOM_FIELD_REQUIRED` and no parent row is written.
- FR-CF-3.5 An integrating module's `update` flow calls `setValues` with only the keys present in
  the request body — omitted keys are left untouched (the same partial-update semantics `PATCH`
  has everywhere else), and required-field presence is **not** re-checked on update.

## FR-CF-4 Member & Family Integration (the flagship wiring — FR-MM extension)

- FR-CF-4.1 `POST /members` accepts an optional `customFields` object, validated and persisted
  under `entityType: "member"` using the member's new id as `entityId`.
- FR-CF-4.2 `PATCH /members/:id` accepts the same `customFields` object with partial-update
  semantics (FR-CF-3.5).
- FR-CF-4.3 `GET /members/:id` and `GET /members` both return each member's current custom field
  values inline as `customFields`; the list endpoint fetches them in one batched query, not one
  query per member.

## FR-CF-5 Non-Functional

- FR-CF-5.1 All custom-field-definition mutations go through the same `@Permissions(...)` guard
  and tenant scoping as every other module.
- FR-CF-5.2 New permission codes: `customfield.definition.create`, `customfield.definition.read`,
  `customfield.definition.update`, `customfield.definition.delete`. Setting/reading *values* is
  covered by whatever permission already guards the owning record (e.g. `member.create` covers
  setting a member's custom field values) — no separate permission axis for values.
- FR-CF-5.3 `CustomFieldDefinition` and `CustomFieldValue` are added to the Prisma tenant-scoping
  extension's `TENANT_SCOPED_MODELS` set.
