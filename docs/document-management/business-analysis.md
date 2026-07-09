# Module 12: Document Management

## 1. Business Description

A church accumulates documents that need a home beyond someone's personal inbox or a shared
drive nobody remembers the folder structure of: board meeting minutes, governing policies,
intake forms, certificates, sermon notes, legal and compliance paperwork. This module is a
single, categorized, searchable store for all of it, with every file living in the same
S3-compatible object store the rest of the platform already uses (tenant logos, member photos,
Asset & Facility Management's document uploads).

This is Module 12 — it depends on Church & Hierarchy (Module 1)'s branches (a document may
optionally be scoped to one), the Foundation module's `User`s (who uploaded it), and the
Storage module (where the file actually lives). No other module depends on it.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actor most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator | Uploads, categorizes, and retrieves documents; replaces an outdated file with a current one |

## 3. Key Business Rules

- **A `Document` *is* the record, unlike Asset & Facility Management's `file`-type custom
  fields (rule #24 in the root README), which are one small attachment on someone else's
  record.** Because of that, `title`/`category`/`description`/`branchId` and the file itself
  are submitted together in one `POST /documents` call — there's no two-step "create the
  parent, then attach the file" dance the way Assets needs, because the Document *is* the
  parent.
- **The document's id is generated before the row exists.** `randomUUID()` produces the id
  client-side (in the service, not the database), so the storage key can be namespaced by it
  in the same call that creates the row — no separate create-then-update round trip.
- **`category` is a `ConfigItem`, not a composed Custom Fields entityType.** Asset & Facility
  Management composes `asset:{category}` because different asset categories genuinely need
  different *extra fields* (rule #23). A document has no category-specific fields to add —
  "policy" and "meeting minutes" are just labels for filtering and organizing, the same reason
  `Contribution.contributionType` or `Event.eventType` are plain `ConfigItem` keys (rule #3)
  rather than something built on the heavier Custom Fields mechanism.
- **Replacing a file is a dedicated action, not part of the metadata `PATCH`.**
  `PATCH /documents/:id/file` accepts `multipart/form-data`; `PATCH /documents/:id` accepts
  JSON for `title`/`category`/`description`/`branchId` only. Mixing the two into one endpoint
  would force every metadata-only edit through a multipart request for no reason.
- **The MIME allowlist and size cap are shared with Asset & Facility Management, not
  duplicated.** Both modules genuinely have the same "what's an acceptable uploaded file"
  concern, so `backend/src/common/constants/file-upload.constants.ts` is the one place that
  answer lives — Documents extends the list slightly (adding spreadsheet and plain-text types,
  since "documents" covers more ground than Assets' narrower "proof of purchase" use case).
- **Replacing a file leaves the old object in the bucket — and now that history is
  first-class, not just an unreachable orphan.** `replaceFile` snapshots the file being
  superseded into a `DocumentVersion` row *before* overwriting `Document`'s own fields, so the
  "leave it in the bucket" behavior any storage system needs (rule #25's neighbor) doubles as
  version history with no separate bookkeeping step a caller could forget. `DocumentVersion` is
  append-only — no update or delete — the same "history isn't rewritten" shape
  `VisitorActivity`/`MemberActivity` already use.
- **A batch upload is many single uploads sharing metadata, not a new kind of record.**
  `POST /documents/batch` creates one ordinary `Document` per file (each gets its own id,
  storage key, and row) rather than introducing a "document group" concept — the same
  `category`/`description`/`branchId` just gets reused across every file in the request, and an
  optional `titlePrefix` becomes each document's title prefix (falling back to the filename
  alone). This keeps every other endpoint (list, download, replace, versions) working
  identically whether a document arrived alone or as part of a batch.
- **Image/video/audio preview reuses the same signed-URL download, not a separate preview
  endpoint.** `GET /documents/:id/download` already returns a time-limited URL; the frontend
  decides whether `contentType` warrants an inline `<img>`/`<video>`/`<audio>` element or a
  plain download link. The MIME allowlist (see below) was extended specifically so these
  content types could reach the platform at all.
- **Soft delete, always** (rule #4) — a document carries no money or audit-trail obligation
  beyond "who uploaded it," which `uploadedByUserId` already answers.

## 4. Out of Scope for This Module

- **Per-document access control (only certain roles can see a specific document).** Every
  document in a tenant is visible to anyone with `document.read`, the same uniform-permission
  shape every other module in this platform uses (no row-level ACL anywhere else either).
  Sensitive documents needing a narrower audience is a real future need, but there's no
  existing row-level permission primitive in this platform to build it on yet.
- **Full-text search inside document contents** — `search` matches `title`/`description` only,
  not what's actually written inside a PDF. OCR/content indexing is a substantial feature on
  its own, not a natural extension of a metadata store.
- **Virus/malware scanning on upload** — the shared MIME allowlist and 25MB size cap
  (`backend/src/common/constants/file-upload.constants.ts`) are the only upload-time checks;
  scanning content for malware needs a 3rd-party service this environment has no credentials
  for, and remains a documented gap consistent with the rest of the platform's file handling.
- **Restoring a previous version as the current file** — a version can be downloaded, but
  "make this old version the current one again" isn't wired up; today that means downloading
  the old version and re-uploading it via `replaceFile`, which itself creates a fresh version
  from whatever was current. A dedicated "restore" action is a small, real addition if this
  turns out to matter in practice, not included in this pass.
