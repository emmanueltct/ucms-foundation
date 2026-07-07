# Functional Requirements — Foundation Module

## FR-1 Tenant Resolution
- FR-1.1 The system resolves the current tenant from (in order of precedence): custom domain →
  `X-Tenant-Slug` header → subdomain → JWT `tenantId` claim.
- FR-1.2 If no tenant can be resolved for a tenant-scoped route, the request is rejected with
  `400 TENANT_NOT_RESOLVED`.
- FR-1.3 If the resolved tenant is inactive (`isActive = false`) or soft-deleted, requests are
  rejected with `403 TENANT_INACTIVE`.

## FR-2 Registration & Login
- FR-2.1 A user registers with `email`, `password`, `firstName`, `lastName` within a resolved
  tenant context. Email is unique **per tenant**, not globally.
- FR-2.2 Passwords are hashed with bcrypt (cost factor 12) and never returned in any response.
- FR-2.3 Password policy: minimum 8 characters, at least one letter and one number.
- FR-2.4 Login returns a short-lived **access token** (JWT, 15 min) and a long-lived
  **refresh token** (7 days, stored hashed, rotated on use).
- FR-2.5 Refresh endpoint rotates the token (old one is revoked) and returns a new pair.
- FR-2.6 Logout revokes the presented refresh token; logout-all revokes every refresh token for
  that user.
- FR-2.7 Login is rate-limited (default: 5 attempts / 60s / IP+email) to slow brute-forcing.

## FR-3 Authorization (RBAC + PBAC)
- FR-3.1 Roles are created per tenant with a name, description, and a set of permission codes.
- FR-3.2 A `@Roles(...)` decorator restricts a route to specific role names (coarse-grained,
  convenience only).
- FR-3.3 A `@Permissions(...)` decorator restricts a route to specific permission codes
  (fine-grained, the source of truth). Prefer this over `@Roles` in new modules.
- FR-3.4 A user may hold multiple roles; permissions are the union of all their roles'
  permissions within the current tenant.
- FR-3.5 Platform Admins bypass tenant-scoped permission checks entirely but cannot call
  tenant-mutating endpoints without also acting *as* a tenant context (impersonation is out of
  scope here; flagged for Platform Admin module).

## FR-4 Configuration Engine
- FR-4.1 A tenant can create/read/update/deactivate/reorder `ConfigItem` records scoped to a
  `namespace` (e.g. `ministry`, `contribution_type`, `ceremony`, `membership_category`).
- FR-4.2 `ConfigItem.value` is an arbitrary JSON payload — the shape is defined by the consuming
  module, not by this engine, so new config "types" require zero schema migrations.
- FR-4.3 A tenant can enable/disable named features via `FeatureToggle`; disabled features
  should be hidden from menus/APIs by the consuming module (this module only stores the flag).
- FR-4.4 Deactivating a `ConfigItem` is a soft toggle (`isActive=false`), never a hard delete,
  so historical records referencing it remain valid.

## FR-5 Audit
- FR-5.1 Login, logout, role changes, and config changes are written to `AuditLog` with
  tenant, user, action, entity type/id, and metadata.

## FR-6 Non-Functional
- FR-6.1 All list endpoints support pagination (`page`, `pageSize`), filtering, and sorting via
  a standard query contract.
- FR-6.2 All responses follow a standard envelope: `{ success, data, meta, error }`.
- FR-6.3 All input DTOs are validated with `class-validator`; invalid input returns `422` with
  field-level errors.
- FR-6.4 Every tenant-scoped Prisma query must include `tenantId` — enforced by code review
  checklist now, Prisma Client Extension middleware in a later hardening pass.
