# Functional Requirements — Dynamic Modules

## FR-DM-1 Module Definitions

- FR-DM-1.1 `POST /dynamic-modules` (`dynamic_module.manage`) creates a
  `DynamicModuleDefinition` with a stable `key` (lowercase letters/numbers/hyphens,
  unique per tenant, immutable once created), `label`, and optionally `description`,
  `icon`, `attachableToEntityTypes`, `statuses` (defaults to `["open", "closed"]`),
  `approvalWorkflowId` (validated to belong to this tenant), `showInNav`.
- FR-DM-1.2 Creating a definition generates five `Permission` rows
  (`dynamicmodule.{id}.create/read/update/delete/approve`) and grants them to every
  `isSystem` role in the tenant.
- FR-DM-1.3 `GET /dynamic-modules` (`dynamic_module.read`) lists active definitions,
  optionally filtered by `?showInNav=true`. `GET /dynamic-modules/by-key/:key` and
  `GET /dynamic-modules/:id` fetch one.
- FR-DM-1.4 `PATCH /dynamic-modules/:id` (`dynamic_module.manage`) may update everything
  except `key`. Setting `statuses` to an empty array is rejected with
  `400 DYNAMIC_MODULE_STATUSES_REQUIRED`.
- FR-DM-1.5 `DELETE /dynamic-modules/:id` (`dynamic_module.manage`) soft-deletes the
  definition. Existing records are untouched.

## FR-DM-2 Records

- FR-DM-2.1 `POST /dynamic-modules/:moduleDefinitionId/records` creates a
  `DynamicModuleRecord`. `attachedToEntityType`/`attachedToEntityId` must be both present
  or both absent (a standalone record has neither). The initial `status` is always the
  module's first configured status. `customFields` (if any) are validated against
  required-field rules and stored via `CustomFieldsService` under
  `entityType: "dynamicmodule:{moduleDefinitionId}"`.
- FR-DM-2.2 `GET /dynamic-modules/:moduleDefinitionId/records` lists records, optionally
  filtered by `attachedToEntityType`/`attachedToEntityId`/`status`/`branchId`, each merged
  with its custom field values.
- FR-DM-2.3 `GET .../records/:id` returns one record (merged with fields);
  `PATCH .../records/:id` updates `title`/`branchId`/`customFields` (partial);
  `DELETE .../records/:id` soft-deletes.
- FR-DM-2.4 `GET .../records/summary` returns record counts grouped by `status` and by
  `branchId` — the module's generic dashboard, no per-module query needed.
- FR-DM-2.5 Every record endpoint is authorized by comparing
  `user.permissions` against `dynamicmodule.{moduleDefinitionId}.{action}` directly in the
  service layer (not the static `@Permissions()` decorator, which cannot express a
  route-param-dependent code). A platform admin bypasses this check, same as
  `PermissionsGuard` does everywhere else.

## FR-DM-3 Status Changes

- FR-DM-3.1 `PATCH .../records/:id/status` (`@RequiresAuditReason()`, permission action
  `approve`) is rejected with `400 DYNAMIC_MODULE_INVALID_STATUS` unless `toStatus` is one
  of the module's configured statuses, and `400 DYNAMIC_MODULE_STATUS_UNCHANGED` if the
  record already has that status.
- FR-DM-3.2 If the module has an `approvalWorkflowId` and `toStatus` is exactly
  `"approved"` or `"rejected"`, the decision is routed through
  `ApprovalWorkflowsService` (`startRequest` then `decide`, entityType
  `"dynamicmodule_record:{moduleDefinitionId}"`) — which enforces the current step's
  gating role/permission. Any other transition is recorded directly via `AuditService`
  (action `dynamic_module_record.status_changed`).
- FR-DM-3.3 Every status change appends a `DynamicModuleRecordStatusHistory` row
  (`fromStatus`, `toStatus`, `changedByUserId`, `reason`), retrievable via
  `GET .../records/:id/status-history`.

## FR-DM-4 Non-Functional

- FR-DM-4.1 `DynamicModuleDefinition`, `DynamicModuleRecord`,
  `DynamicModuleRecordStatusHistory` are added to the Prisma tenant-scoping extension's
  `TENANT_SCOPED_MODELS` set.
- FR-DM-4.2 Two migration-seeded permission codes gate the module builder itself:
  `dynamic_module.manage` (create/update/delete definitions) and `dynamic_module.read`
  (view definitions, including for the sidebar nav merge). Per-module record permissions
  are generated at runtime (FR-DM-1.2), the one documented exception to `Permission`'s
  "migration only" convention.
- FR-DM-4.3 The frontend's Custom Fields settings page lists every active Dynamic Module
  as a selectable entity type (`dynamicmodule:{id}`) automatically, the same way it already
  lists asset categories — no separate "manage this module's fields" UI was built.
- FR-DM-4.4 `components/admin-nav.tsx` fetches `GET /dynamic-modules?showInNav=true` once
  per navigation and appends each to the sidebar, linking to
  `/admin/modules/{key}` — one generic frontend page renders every module's records.
