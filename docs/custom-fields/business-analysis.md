# Cross-Cutting Module: Custom Fields

## 1. Business Description

The platform's founding rule — "never assume all churches operate the same way, everything must
be configurable" — has so far meant tenant-configurable *values* (contribution types, ministry
types, membership categories, all `ConfigItem` rows). This module takes that one level further:
a tenant can add entirely new *fields* to a form that don't exist for any other tenant. A
Catholic parish can track Confirmation Date on Member profiles; a Baptist church that has no
concept of confirmation never sees that field. Neither requires a code change, a migration, or
waiting on a platform update.

Unlike every other module so far, this one is cross-cutting rather than owning a single domain
concept — it's a mechanism other modules opt into. Module 2 (Member & Family Management) is its
flagship integration today; the same mechanism is designed to extend to Finance, Attendance, and
Ministry without any change to this module itself.

## 2. Actors

| Actor | Relevance to this module |
|---|---|
| Church Administrator | Defines which custom fields exist for their tenant, per entity type |
| Any user creating/editing a record (Member, eventually others) | Fills in whatever custom fields are currently defined, alongside the fixed core fields |

## 3. Key Business Rules

- **Two halves: definitions and values.** `CustomFieldDefinition` (what fields exist, per
  tenant + entity type) and `CustomFieldValue` (one record's answer for one field) are separate
  tables — the classic EAV split. This means a brand-new entity type never requires a schema
  change here: it just starts passing its own `entityType` string.
- **`entityType` is a free string, not an enum.** Consistent with the Foundation module's rule
  that new "types" belong in configuration, not schema — applied one level up, to the fields
  themselves rather than to values within a fixed field.
- **Six field types cover the common cases**: `text`, `number`, `date`, `boolean`, `select`
  (with tenant-defined options), and `file` (added for Asset & Facility Management, Module 10 —
  see `docs/asset-management/business-analysis.md`). This is deliberately not an arbitrarily
  extensible type system — six types cover what a church's forms actually need, and adding one
  was a contained, well-understood change, exactly as anticipated here.
- **`fieldKey`, `entityType`, and `fieldType` are immutable once a definition is created.**
  Changing any of them would silently reinterpret every existing `CustomFieldValue` row that
  references that key. Retire the field (soft-deactivate) and create a new one instead — the
  same reasoning `Ministry`/`Branch`/etc. already apply to their own identity-defining fields.
- **A definition is deactivated, never hard-deleted** — mirrors `ConfigItem` exactly (same
  deactivate/reactivate API shape), since existing `CustomFieldValue` rows referencing a retired
  field remain valid history even after the field stops appearing on new forms.
- **Required-field validation happens before the parent record is written**, not after — a
  module integrating this (see Member & Family's `MembersService.create`) calls
  `assertRequiredFieldsProvided` first, so a missing required custom field never leaves a
  half-created row behind.
- **Value validation is type-aware but intentionally light.** `text`/`number`/`boolean`/`date`
  check the JS type (or that a date string parses); `select` checks the value is one of the
  definition's declared option keys; `file` checks the value is shaped `{ key, filename }` — this
  module never receives or validates the binary itself, only the storage reference an integrating
  module writes after it uploads the file (see Asset & Facility Management for the first real
  consumer). This isn't a general-purpose schema validator — it's enough to catch "the frontend
  sent the wrong shape," not to replace `class-validator` on the fixed core fields.
- **Reading a record always returns its custom field values inline** (`member.customFields`),
  fetched via one batched query per list request (`getValuesForMany`) — a list endpoint never
  does one custom-fields query per row.

## 4. Out of Scope for This Module

- **Wiring into every entity at once.** Member & Family Management (`entityType: "member"`) is
  the complete, tested integration today. Finance, Attendance, and Ministry are designed to be
  wireable the same way (inject `CustomFieldsService`, call `assertRequiredFieldsProvided` +
  `setValues` in `create`, attach `getValues`/`getValuesForMany` on reads) — but that wiring
  hasn't been done for them yet. Extending this to a new entity is a mechanical, well-understood
  step, not a redesign.
- **Cross-tenant field templates / a marketplace of pre-built field sets** — every tenant defines
  its own fields from scratch today; sharing common sets ("standard Catholic parish fields") is a
  future convenience layer, not a prerequisite.
- **Computed/derived custom fields, conditional visibility, or field-to-field dependencies** — a
  custom field is a plain, independent value; "show this field only if that one is set" is a form-
  builder feature, not a data-model one, and isn't needed yet.
- **Custom fields on `Notification` or platform-level entities** — this module only makes sense
  for records a church actually creates and configures (Member, Contribution, ...), not for
  system-generated records.
