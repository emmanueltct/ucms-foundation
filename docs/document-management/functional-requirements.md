# Functional Requirements — Document Management

## FR-DOC-1 Uploading a Document

- FR-DOC-1.1 `POST /documents` accepts `multipart/form-data` with required `title`, `category`,
  and a `file` part, plus optional `description`, `branchId`.
- FR-DOC-1.2 If `branchId` is provided, it must reference an existing, non-deleted branch
  within the same tenant, or the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-DOC-1.3 A `file` part is required, or the request is rejected with
  `400 DOCUMENT_FILE_REQUIRED`.
- FR-DOC-1.4 Only the content types in the shared document allowlist (PDF, JPEG, PNG, DOC,
  DOCX, XLS, XLSX, plain text) are accepted, rejected otherwise with
  `400 DOCUMENT_TYPE_UNSUPPORTED`. Files over 10MB are rejected by the upload interceptor
  before reaching the handler (mirrored by an explicit `400 DOCUMENT_TOO_LARGE` check in the
  service for defense in depth).
- FR-DOC-1.5 `uploadedByUserId` is set from the authenticated caller, not client-supplied.

## FR-DOC-2 Listing & Reading

- FR-DOC-2.1 `GET /documents` returns a paginated list filterable by `branchId`, `category`,
  and `search` (matches `title` or `description`, case-insensitive). Soft-deleted documents
  are always excluded.
- FR-DOC-2.2 `GET /documents/:id` returns one document's metadata.
- FR-DOC-2.3 `GET /documents/:id/download` returns a time-limited signed URL plus the
  original `fileName`.

## FR-DOC-3 Updating & Replacing

- FR-DOC-3.1 `PATCH /documents/:id` accepts JSON and may update `title`, `category`,
  `description`, `branchId` — never the file itself.
- FR-DOC-3.2 `PATCH /documents/:id/file` accepts `multipart/form-data` with a required `file`
  part and replaces `fileKey`/`fileName`/`fileSize`/`contentType`. Subject to the same type/
  size validation as FR-DOC-1.4.

## FR-DOC-4 Deleting

- FR-DOC-4.1 `DELETE /documents/:id` soft-deletes the document (`deletedAt`,
  `isActive=false`). The underlying storage object is not deleted.

## FR-DOC-5 Non-Functional

- FR-DOC-5.1 All document mutations go through the same `@Permissions(...)` guard and tenant
  scoping as every other module.
- FR-DOC-5.2 New permission codes: `document.create`, `document.read`, `document.update`
  (also guards file replacement), `document.delete`.
- FR-DOC-5.3 `Document` is added to the Prisma tenant-scoping extension's
  `TENANT_SCOPED_MODELS` set.
- FR-DOC-5.4 New `ConfigItem` namespace: `document_category`.
