# API Design — Asset & Facility Management

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Assets (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/assets` | `asset.create` | Register an asset under a category |
| GET | `/assets` | `asset.read` | Paginated list (`?branchId=&assetCategory=&status=&search=`) |
| GET | `/assets/:id` | `asset.read` | Get one asset, with its category's custom field values |
| PATCH | `/assets/:id` | `asset.update` | Update an asset (`assetCategory` is immutable) |
| DELETE | `/assets/:id` | `asset.delete` | Soft-delete an asset |
| POST | `/assets/:id/documents?fieldKey=` | `asset.update` | Upload a document against a `file`-type custom field |
| GET | `/assets/:id/documents/:fieldKey/download` | `asset.read` | Get a signed download URL for a previously uploaded document |

## Request/response shapes worth calling out

`POST /assets` (a vehicle, with its category-specific custom fields inline):

```json
{
  "name": "Toyota Hiace — Youth Van",
  "assetCategory": "vehicle",
  "assetTag": "VEH-0003",
  "condition": "good",
  "acquisitionDate": "2024-03-01",
  "acquisitionCost": 18000000,
  "customFields": {
    "make_model": "Toyota Hiace 2023",
    "license_plate": "RAD 123 A",
    "mileage_km": 42000
  }
}
```

Response (`data`):

```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "branchId": null,
  "name": "Toyota Hiace — Youth Van",
  "assetCategory": "vehicle",
  "assetTag": "VEH-0003",
  "condition": "good",
  "status": "in_use",
  "acquisitionDate": "2024-03-01T00:00:00.000Z",
  "acquisitionCost": "18000000",
  "currentValue": null,
  "currency": "RWF",
  "isActive": true,
  "customFields": {
    "make_model": "Toyota Hiace 2023",
    "license_plate": "RAD 123 A",
    "mileage_km": 42000
  }
}
```

`POST /assets/:id/documents?fieldKey=insurance_document` (multipart):

```
Content-Type: multipart/form-data
file: <binary>
```

Response (`data`):

```json
{ "key": "tenants/.../assets/.../insurance_document/1720440000000-insurance.pdf", "filename": "insurance.pdf", "size": 245678, "contentType": "application/pdf" }
```

`GET /assets/:id/documents/insurance_document/download`:

```json
{ "url": "https://.../insurance.pdf?X-Amz-Signature=...", "filename": "insurance.pdf" }
```

## Defining category-specific fields (reuses the existing Custom Fields API)

No new endpoint — a Church Administrator defines fields for a category the same way they
define fields for `member`, just with `entityType` composed as `asset:{category}`:

```json
POST /custom-field-definitions
{ "entityType": "asset:vehicle", "fieldKey": "mileage_km", "label": "Mileage (km)", "fieldType": "number" }
```

```
GET /custom-field-definitions?entityType=asset:vehicle
```

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `ASSET_NOT_FOUND` | 404 | Asset doesn't exist in this tenant |
| `ASSET_TAG_TAKEN` | 409 | This `assetTag` is already in use within the tenant |
| `ASSET_DOCUMENT_FILE_REQUIRED` | 400 | No `file` part was included in the multipart body |
| `ASSET_DOCUMENT_TYPE_UNSUPPORTED` | 400 | The uploaded file's content type isn't on the accepted list |
| `ASSET_DOCUMENT_FIELD_INVALID` | 400 | `fieldKey` doesn't name an active `file`-type field for this asset's category |
| `ASSET_DOCUMENT_NOT_FOUND` | 404 | No file has been uploaded yet for this `fieldKey` |
| `BRANCH_NOT_FOUND` | 404 | (Reused from Module 1) `branchId` doesn't resolve within the tenant |
| `CUSTOM_FIELD_REQUIRED` / `CUSTOM_FIELD_UNKNOWN` / `CUSTOM_FIELD_INVALID_VALUE` | 400 | (Reused from the Custom Fields module) |
