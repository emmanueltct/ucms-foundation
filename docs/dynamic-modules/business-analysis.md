# Module 17: Dynamic Modules — the no-code Module Builder

## 1. Business Description

Every module built so far in this platform (Ministries, Small Groups, Assets, Documents,
Visitors, Hierarchy Requirements, ...) has the same shape underneath: a record type with a
status, optional custom fields, optionally attached to an existing entity, optionally
gated by an approval chain. This module lets a Church Administrator define that shape
themselves — a brand-new functional module (Committee Requests, Building Project
Approvals, Choir Robes Inventory, or anything else a specific church needs) — without a
line of code being written or deployed.

A Dynamic Module has two parts: the **definition** (its label, its ordered list of
statuses, whether it shows in the sidebar, and an optional approval workflow) and its
**records** (the actual data entered against it). Records can either attach to something
that already exists (a Branch, a Ministry, a Member, another Dynamic Module's record) or
stand alone — in which case the module's own records *are* a brand-new entity type other
things can later attach to (see design decision below).

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).

| Actor | Relevance to this module |
|---|---|
| Church Administrator | Builds module definitions on the Dynamic Module Builder page |
| Whoever holds a generated `dynamicmodule.{id}.{action}` permission | Creates/reads/updates/deletes/changes status on that module's records — see rule below |
| Approver (per the module's optional `ApprovalWorkflow`) | Decides an "approved"/"rejected" status change when the module has one configured |

## 3. Key Business Rules

- **A module's record-level permissions are generated, not migration-seeded — the one
  deliberate exception to `Permission`'s own "add rows via migration only" rule.**
  `DynamicModuleDefinitionsService.create` appends five `Permission` rows
  (`dynamicmodule.{definitionId}.create/read/update/delete/approve`) the moment a module is
  built, namespaced by the definition's own globally-unique id so codes can never collide
  across tenants or across two modules in the same tenant. They're immediately granted to
  every `isSystem` role in the tenant (mirroring `TenantsService.bootstrapAdminUser`'s own
  convention for the "Church Administrator" role), so the admin who just built the module
  can use it right away.
- **Record-level authorization is checked in the service layer, not via `@Permissions()`.**
  The static `@Permissions()` decorator can't express a permission code that depends on a
  route parameter (`:moduleDefinitionId`), so `DynamicModuleRecordsService` compares
  `user.permissions` against the generated code directly. The global
  Jwt/Roles/PermissionsGuard pipeline still runs for every request — `PermissionsGuard`
  simply passes through routes that declare no static permission requirement.
- **"Creating a new entity type" is modeled as a Dynamic Module whose records stand
  alone**, not a second registry. `DynamicModuleRecord.attachedToEntityType`/
  `attachedToEntityId` are both null for such a record — it doesn't attach to anything,
  it *is* the new thing. Other records (from this or another module) then attach to it via
  `attachedToEntityType: "dynamicmodule:{thisDefinitionId}"`. One polymorphic mechanism
  serves both "a new business process" and "a new kind of thing records attach to."
- **Custom fields need no new mechanism.** A module's fields are ordinary
  `CustomFieldDefinition`/`CustomFieldValue` rows keyed by
  `entityType: "dynamicmodule:{definitionId}"` — the same composition trick already proven
  for Assets/Visitor Activities/Member Activities/Hierarchy Requirements. The existing
  Custom Fields settings page lists every Dynamic Module as a selectable entity type
  automatically, the same way it already lists every asset category.
- **Statuses are a plain, tenant-ordered `String[]` on the definition, not a `ConfigItem`
  namespace.** A module's status list is tightly coupled to that one module (ordering,
  the default-on-create value) in a way a shared, cross-module `ConfigItem` namespace
  would add an indirection to without benefit — a plain array the admin edits directly on
  the module builder form is simpler and exactly as configurable.
- **A status change is only routed through the module's `ApprovalWorkflow` when moving to
  literally "approved" or "rejected."** Any other status transition (e.g. "open" →
  "in_review") is direct — recorded via `AuditService` with a mandatory reason, and
  appended to `DynamicModuleRecordStatusHistory`. This deliberately does not build a full
  state-machine keyed by arbitrary status pairs; nothing in the original requirements asks
  for per-transition gating beyond "who approves this."
- **`DynamicModuleRecordStatusHistory` is a real table, unlike an `ApprovalRequest`
  decision (which lives only in `AuditLog`).** A record's status timeline is something
  this module's own UI displays directly (not just an audit concern), so it earns its own
  append-only table rather than being reconstructed from `AuditLog` queries.
- **Soft-deleting a module definition does not cascade to its records.** Existing records
  are left exactly as they are — a defensible, explicit choice consistent with every other
  soft-delete in this platform never silently cascading data loss.

## 4. Out of Scope for This Module

- **A full BPMN/arbitrary state-machine engine per module** — see the "approved/rejected
  only" rule above. A tenant needing genuinely branching, multi-path workflows is a real,
  future need if it ever comes up, not built speculatively now.
- **Re-decidable approval requests** — like Hierarchy Requirements' submissions, a given
  `(dynamicmodule_record, entityId)` approval request can only be decided once
  (`ApprovalWorkflowsService`'s own `APPROVAL_REQUEST_ALREADY_DECIDED` rule). A record
  that needs to cycle through approval more than once needs a new record per cycle, the
  same pattern Hierarchy Requirements' `periodLabel` already establishes.
- **Per-field, per-status conditional visibility or required-ness** — a module's custom
  fields are either required or not (Custom Fields' existing `isRequired`), not
  conditionally required depending on the record's current status.
- **A drag-and-drop visual builder UI** — the Dynamic Module Builder page is a form, the
  same as every other admin settings page in this platform, not a canvas-based designer.
