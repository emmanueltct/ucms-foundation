# Module 10: Asset & Facility Management

## 1. Business Description

A church owns physical assets — buildings, land, vehicles, sound equipment, furniture,
instruments — and needs a single register of what it owns, where it is, what condition it's
in, and (for some categories) supporting documents like proof of purchase, insurance, or
title deeds. Different categories genuinely need different details: a vehicle's mileage and
license plate mean nothing for a building, and a building's floor count means nothing for a
vehicle. This module is the system of record for that register, and it's the second
consumer (after Member & Family Management) of the Custom Fields mechanism, used in a new way:
one entity, many category-specific field sets, all from the same underlying table.

This is Module 10 — it depends on Church & Hierarchy (Module 1)'s branches (an asset may
optionally be scoped to one), the Configuration Engine (asset categories and conditions are
`ConfigItem`s, not a hard-coded enum), the Custom Fields module (category-specific fields),
and the Storage module (document uploads). No other module depends on it.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).
The actor most relevant here:

| Actor | Relevance to this module |
|---|---|
| Church Administrator / Facilities Manager | Registers assets, keeps the register current, uploads supporting documents |

## 3. Key Business Rules

- **`assetCategory` is a `ConfigItem` key, not a hard-coded enum** — the same reasoning
  `branchType`/`contributionType`/`staffPosition` already established (rule #3 in the root
  README): categories genuinely vary by church, so they belong in configuration.
- **Each category gets its own field set through a naming trick, not a new table.** The
  Custom Fields module's `entityType` is a free string (see rule #17 in the root README); this
  module composes it as `asset:{assetCategory}` — `asset:vehicle`, `asset:building`, and so on.
  A church defining fields for "Vehicle" through the Custom Fields settings screen is really
  defining `CustomFieldDefinition` rows with `entityType = "asset:vehicle"`; nothing about the
  Custom Fields module itself changed to make this possible. This is the pattern rule #17
  anticipated: extending Custom Fields to a new entity is "a mechanical repeat... not a
  redesign" — here it's repeated once per category instead of once per entity.
- **`assetCategory` is fixed once an asset is created.** Changing it would silently orphan
  any custom field values already recorded under the old `asset:{oldCategory}` entityType —
  the same reasoning that makes `Member.branchId` and `CustomFieldDefinition.fieldType`
  immutable-after-creation elsewhere in this platform. If a category was picked wrong,
  soft-delete the asset and register it again under the correct one.
- **The Custom Fields module gained a sixth field type, `file`, for this module.** A
  `file`-type value is `{ key, filename, size, contentType }` — a reference to an object
  already uploaded to the Storage module, never the binary itself. Custom Fields validates the
  *shape* of that reference the same lightweight way it validates every other type; it has no
  idea what's actually in the file.
- **A document upload is a dedicated endpoint, not part of `PATCH /assets/:id`.** Uploading
  a file needs `multipart/form-data`, not JSON, and needs the asset to already exist (the
  storage key is namespaced by `assetId`). `POST /assets/:id/documents?fieldKey=...` handles
  the upload, validates `fieldKey` names an active `file`-type field for this asset's
  category, stores the object, and writes the resulting reference as that custom field's
  value — one call, not an upload-then-patch two-step.
- **Only the shared document/image/video/audio allowlist is accepted**, capped at 25MB —
  reasonable formats for "proof of purchase," "insurance certificate," or "title deed" (and,
  since the allowlist is shared with Document Management, whatever an `image`/`video`/`audio`
  custom field on an asset needs too), without accepting arbitrary file types. See
  `backend/src/common/constants/file-upload.constants.ts`.
- **Downloading a document never returns the file directly** — `GET
  /assets/:id/documents/:fieldKey/download` returns a time-limited signed URL (via the
  Storage module's existing `getSignedDownloadUrl`), the same pattern already used for tenant
  logos and member photos.
- **Soft delete, always** (rule #4) — `deletedAt`/`isActive`, same as every non-financial
  record elsewhere in this platform. An asset's uploaded documents are not deleted from
  storage when the asset is soft-deleted (out of scope — see below).

## 4. Out of Scope for This Module

- **Recategorizing an asset** — since `assetCategory` is fixed at creation (see above), there
  is no `PATCH /assets/:id/recategorize` endpoint. Correcting a mis-categorized asset means
  creating a new one under the right category and soft-deleting the old one.
- **Depreciation schedules / automatic value decay** — `currentValue` is a plain field the
  Facilities Manager updates manually if they track it at all; there's no depreciation engine
  computing it from `acquisitionCost` and an age-based formula.
- **Maintenance scheduling / work orders** — `status` includes `under_maintenance` as a state
  an asset can be in, but there's no maintenance-ticket or scheduling system behind it. A
  future module could add that on top of this register without changing `Asset` itself.
- **A custodian / assigned-to person** — nothing in the current requirement calls for tracking
  who's personally responsible for an asset day-to-day; `location` (free text) and `branchId`
  cover "where it is," which is what was asked for.
- **Deleting storage objects when an asset is soft-deleted or a document is replaced** — a
  re-uploaded document for the same `fieldKey` simply overwrites the custom field's value
  with a new storage key; the previous object is left in the bucket rather than deleted, the
  same "don't hard-delete on a whim" caution applied to every soft-deleted row elsewhere. A
  storage lifecycle/cleanup policy is an operational concern, not an application one.
