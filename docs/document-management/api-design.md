# API Design — Document Management

Base path: `/api/v1` (same envelope, tenant resolution, and pagination contract as the
Foundation module — see [../api-design.md](../api-design.md)).

## Documents (tenant-scoped)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/documents` | `document.create` | Upload a document (metadata + file, one call) |
| POST | `/documents/batch` | `document.create` | Upload several files at once, each becoming its own document sharing category/description/branch |
| GET | `/documents` | `document.read` | Paginated list (`?branchId=&category=&search=`) |
| GET | `/documents/:id` | `document.read` | Get one document's metadata |
| PATCH | `/documents/:id` | `document.update` | Update title/category/description/branch |
| PATCH | `/documents/:id/file` | `document.update` | Replace the stored file (the old one becomes a version) |
| DELETE | `/documents/:id` | `document.delete` | Soft-delete a document |
| GET | `/documents/:id/download` | `document.read` | Get a signed download URL |
| GET | `/documents/:id/versions` | `document.read` | List superseded file versions, most recent first |
| GET | `/documents/:id/versions/:versionId/download` | `document.read` | Get a signed download URL for a previous version |

## Request/response shapes worth calling out

`POST /documents` (multipart):

```
Content-Type: multipart/form-data
title: Board Meeting Minutes — March 2026
category: minutes
description: Approved at the April board meeting.
file: <binary>
```

Response (`data`):

```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "branchId": null,
  "title": "Board Meeting Minutes — March 2026",
  "category": "minutes",
  "description": "Approved at the April board meeting.",
  "fileKey": "tenants/.../documents/.../1720440000000-minutes.pdf",
  "fileName": "minutes.pdf",
  "fileSize": 245678,
  "contentType": "application/pdf",
  "uploadedByUserId": "uuid",
  "isActive": true
}
```

`GET /documents/:id/download`:

```json
{ "url": "https://.../minutes.pdf?X-Amz-Signature=...", "filename": "minutes.pdf" }
```

`POST /documents/batch` (multipart, `files` repeated):

```
Content-Type: multipart/form-data
category: minutes
titlePrefix: Board Meeting Photos
files: <binary>
files: <binary>
```

Response (`data`) is an array of documents, one per uploaded file, in the same shape as
`POST /documents`'s response.

`GET /documents/:id/versions` response (`data`):

```json
[
  {
    "id": "uuid",
    "documentId": "uuid",
    "fileName": "minutes-v1.pdf",
    "fileSize": 198765,
    "contentType": "application/pdf",
    "replacedByUserId": "uuid",
    "createdAt": "2026-06-01T10:00:00.000Z"
  }
]
```

`GET /documents/:id/versions/:versionId/download` mirrors `GET /documents/:id/download`'s
shape, pointing at that specific historical file.

## Error codes introduced by this module

| Code | HTTP | Meaning |
|---|---|---|
| `DOCUMENT_NOT_FOUND` | 404 | Document doesn't exist in this tenant |
| `DOCUMENT_FILE_REQUIRED` | 400 | No `file`/`files` part was included in the multipart body |
| `DOCUMENT_TYPE_UNSUPPORTED` | 400 | The uploaded file's content type isn't on the accepted list |
| `DOCUMENT_TOO_LARGE` | 400 | The uploaded file exceeds 25MB |
| `DOCUMENT_VERSION_NOT_FOUND` | 404 | `versionId` doesn't belong to this document within the tenant |
| `BRANCH_NOT_FOUND` | 404 | (Reused from Module 1) `branchId` doesn't resolve within the tenant |
