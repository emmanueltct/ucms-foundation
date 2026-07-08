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
- **Replacing a file leaves the old object in the bucket.** The same reasoning Asset &
  Facility Management already established (rule #25's neighbor in its own business analysis):
  a storage lifecycle/cleanup policy is an operational concern, not something this module's
  API needs to implement.
- **Soft delete, always** (rule #4) — a document carries no money or audit-trail obligation
  beyond "who uploaded it," which `uploadedByUserId` already answers.

## 4. Out of Scope for This Module

- **Version history / rollback to a previous file.** `PATCH /documents/:id/file` replaces the
  current file's reference; there's no list of prior versions to restore. If version history
  becomes a real requirement, it's a genuinely different data shape (a `DocumentVersion` child
  table) worth its own pass, not a speculative addition now.
- **Per-document access control (only certain roles can see a specific document).** Every
  document in a tenant is visible to anyone with `document.read`, the same uniform-permission
  shape every other module in this platform uses (no row-level ACL anywhere else either).
  Sensitive documents needing a narrower audience is a real future need, but there's no
  existing row-level permission primitive in this platform to build it on yet.
- **In-browser preview / rendering of the document** — `GET /documents/:id/download` returns
  a signed URL the same way Asset & Facility Management's document download does; what the
  frontend does with that URL (open it, embed it, force a download) is a UI concern, not
  something this module's API needs to distinguish.
- **Full-text search inside document contents** — `search` matches `title`/`description` only,
  not what's actually written inside a PDF. OCR/content indexing is a substantial feature on
  its own, not a natural extension of a metadata store.
