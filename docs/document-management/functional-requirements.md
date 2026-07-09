# Functional Requirements — Document Management

## FR-DOC-1 Uploading a Document

- FR-DOC-1.1 `POST /documents` accepts `multipart/form-data` with required `title`, `category`,
  and a `file` part, plus optional `description`, `branchId`.
- FR-DOC-1.2 If `branchId` is provided, it must reference an existing, non-deleted branch
  within the same tenant, or the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-DOC-1.3 A `file` part is required, or the request is rejected with
  `400 DOCUMENT_FILE_REQUIRED`.
- FR-DOC-1.4 Only the content types in the shared document allowlist (PDF, JPEG, PNG, GIF,
  WEBP, DOC, DOCX, XLS, XLSX, plain text, MP4/WEBM/QuickTime video, MP3/WAV/OGG audio) are
  accepted, rejected otherwise with `400 DOCUMENT_TYPE_UNSUPPORTED`. Files over 25MB are
  rejected by the upload interceptor before reaching the handler (mirrored by an explicit
  `400 DOCUMENT_TOO_LARGE` check in the service for defense in depth).
- FR-DOC-1.5 `uploadedByUserId` is set from the authenticated caller, not client-supplied.
- FR-DOC-1.6 `POST /documents/batch` accepts `multipart/form-data` with required `category`
  and one or more `files` parts (up to 20), plus optional `titlePrefix`, `description`,
  `branchId` shared by every file. Creates one `Document` per file — title is
  `"{titlePrefix} — {originalFilename}"` when `titlePrefix` is given, or just the filename
  otherwise. If any file fails validation (FR-DOC-1.4), the whole batch is rejected before any
  file is uploaded or any row created.

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
  size validation as FR-DOC-1.4. Before overwriting, the file being replaced is snapshotted
  into a `DocumentVersion` row (FR-DOC-6).

## FR-DOC-4 Deleting

- FR-DOC-4.1 `DELETE /documents/:id` soft-deletes the document (`deletedAt`,
  `isActive=false`). The underlying storage object is not deleted.

## FR-DOC-6 Version History

- FR-DOC-6.1 Every successful `PATCH /documents/:id/file` call creates one `DocumentVersion`
  row capturing the file *being replaced* (`fileKey`, `fileName`, `fileSize`, `contentType`,
  and `replacedByUserId` set from the authenticated caller) before the `Document` row itself is
  updated to point at the new file.
- FR-DOC-6.2 `GET /documents/:id/versions` returns every version for that document, most
  recent first. There is no update or delete endpoint — a version is permanent history.
- FR-DOC-6.3 `GET /documents/:id/versions/:versionId/download` returns a time-limited signed
  URL for that specific historical file, rejecting with `404 DOCUMENT_VERSION_NOT_FOUND` if
  `versionId` doesn't belong to `id` within the tenant.

## FR-DOC-7 Non-Functional

- FR-DOC-7.1 All document mutations go through the same `@Permissions(...)` guard and tenant
  scoping as every other module.
- FR-DOC-7.2 New permission codes: `document.create`, `document.read`, `document.update`
  (also guards file replacement), `document.delete`. Batch upload reuses `document.create`;
  version listing/download reuse `document.read` — no new permission codes for either.
- FR-DOC-7.3 `Document` and `DocumentVersion` are added to the Prisma tenant-scoping
  extension's `TENANT_SCOPED_MODELS` set.
- FR-DOC-7.4 New `ConfigItem` namespace: `document_category`.
