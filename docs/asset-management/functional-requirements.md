# Functional Requirements — Asset & Facility Management

## FR-AST-1 Registering an Asset

- FR-AST-1.1 A tenant can create an `Asset` with required `name`, `assetCategory`, and
  optional `branchId`, `assetTag`, `condition`, `status` (default `in_use`), `location`,
  `acquisitionDate`, `acquisitionCost`, `currentValue`, `currency`, `notes`, `customFields`.
- FR-AST-1.2 If `branchId` is provided, it must reference an existing, non-deleted branch
  within the same tenant, or the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-AST-1.3 If `assetTag` is provided, it must be unique within the tenant, or the request
  is rejected with `409 ASSET_TAG_TAKEN`.
- FR-AST-1.4 `customFields` is validated against whatever fields the tenant has defined for
  entityType `asset:{assetCategory}` (see FR-AST-5) before the asset is created — a missing
  required field is rejected with `400 CUSTOM_FIELD_REQUIRED` before any row is written.
- FR-AST-1.5 If `acquisitionCost` or `currentValue` is provided without `currency`, `currency`
  defaults to the tenant's configured currency.

## FR-AST-2 Listing & Reading

- FR-AST-2.1 `GET /assets` returns a paginated list filterable by `branchId`, `assetCategory`,
  `status`, and `search` (matches `name` or `assetTag`, case-insensitive). Soft-deleted assets
  are always excluded.
- FR-AST-2.2 `GET /assets/:id` returns one asset merged with its `asset:{assetCategory}`
  custom field values, the same shape Member & Family Management already returns.

## FR-AST-3 Updating & Deleting

- FR-AST-3.1 `PATCH /assets/:id` may update any field except `id`/`tenantId`/`assetCategory` —
  `assetCategory` is fixed at creation (see business analysis rule).
- FR-AST-3.2 `DELETE /assets/:id` soft-deletes the asset (`deletedAt`, `isActive=false`).

## FR-AST-4 Document Upload & Download

- FR-AST-4.1 `POST /assets/:id/documents?fieldKey=...` accepts a `multipart/form-data` body
  with a single `file` field.
- FR-AST-4.2 `fieldKey` must name an active `file`-type `CustomFieldDefinition` for this
  asset's `asset:{assetCategory}` entityType, or the request is rejected with
  `400 ASSET_DOCUMENT_FIELD_INVALID`.
- FR-AST-4.3 Only `application/pdf`, `image/jpeg`, `image/png`, `application/msword`, and
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document` are accepted,
  rejected otherwise with `400 ASSET_DOCUMENT_TYPE_UNSUPPORTED`. Files over 10MB are rejected
  by the upload interceptor before reaching the handler.
- FR-AST-4.4 On success, the file is stored at
  `tenants/{tenantId}/assets/{assetId}/{fieldKey}/{timestamp}-{originalFilename}` and the
  custom field's value is set to `{ key, filename, size, contentType }` in one call — no
  separate `PATCH` is needed to attach it.
- FR-AST-4.5 `GET /assets/:id/documents/:fieldKey/download` returns a time-limited signed
  URL plus the original `filename`. If nothing has been uploaded for that field yet, it's
  rejected with `404 ASSET_DOCUMENT_NOT_FOUND`.

## FR-AST-5 Custom Fields Extension

- FR-AST-5.1 `CustomFieldDefinition.fieldType` gains a sixth value, `file` (alongside `text`,
  `number`, `date`, `boolean`, `select`). A `file`-type value must be an object shaped
  `{ key: string, filename: string }` or it's rejected with `400 CUSTOM_FIELD_INVALID_VALUE`
  — the same validation entry point every other field type already goes through.
- FR-AST-5.2 Defining fields for a new asset category requires no schema change: a Church
  Administrator creates `CustomFieldDefinition` rows with `entityType = "asset:{category}"`
  through the existing custom field definitions screen/endpoint.

## FR-AST-6 Non-Functional

- FR-AST-6.1 All asset mutations go through the same `@Permissions(...)` guard and tenant
  scoping as every other module.
- FR-AST-6.2 New permission codes: `asset.create`, `asset.read`, `asset.update` (also guards
  document upload), `asset.delete`.
- FR-AST-6.3 `Asset` is added to the Prisma tenant-scoping extension's `TENANT_SCOPED_MODELS`
  set.
- FR-AST-6.4 New `ConfigItem` namespaces: `asset_category`, `asset_condition`.
