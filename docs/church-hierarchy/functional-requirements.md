# Functional Requirements — Church & Hierarchy Management

## FR-CH-1 Branch CRUD

- FR-CH-1.1 A tenant can create a `Branch` with a `name` and, optionally, a `parentBranchId`,
  `branchType`, `code`, `address`, `isHeadquarters`, and `sortOrder`.
- FR-CH-1.2 If `parentBranchId` is provided, it must reference an existing, non-deleted branch
  within the same tenant, or the request is rejected with `404 BRANCH_NOT_FOUND`.
- FR-CH-1.3 Setting `isHeadquarters: true` on a branch clears the flag from any other branch
  that previously held it within the same tenant.
- FR-CH-1.4 Updating a branch (`PATCH /branches/:id`) may change `name`, `branchType`, `code`,
  `address`, `sortOrder`, and `isHeadquarters`, but **not** `parentBranchId` — re-parenting is
  only available via the dedicated move endpoint (FR-CH-3).

## FR-CH-2 Hierarchy Queries

- FR-CH-2.1 `GET /branches` returns a flat, ordered (`sortOrder` then `name`) list of a
  tenant's active branches; `?includeInactive=true` includes deactivated ones.
- FR-CH-2.2 `GET /branches/tree` returns the same data assembled into a nested tree.
- FR-CH-2.3 `GET /branches/:id/ancestors` returns the chain from the branch's immediate parent
  up to the root, immediate parent first.
- FR-CH-2.4 `GET /branches/:id/descendants` returns every descendant (children, grandchildren,
  ...) flattened, in no particular guaranteed order beyond breadth-first discovery.

## FR-CH-3 Moving a Branch

- FR-CH-3.1 `PATCH /branches/:id/move` changes a branch's `parentBranchId` (or clears it,
  moving the branch to the root) after verifying the new parent exists within the same tenant.
- FR-CH-3.2 A move is rejected with `400 BRANCH_CIRCULAR_REFERENCE` if the target parent is the
  branch itself, or if the target parent is already one of the branch's own descendants.

## FR-CH-4 Soft Delete & Cascading

- FR-CH-4.1 There is no hard-delete endpoint for branches — only deactivate/reactivate — so
  historical records (a member or contribution tied to a since-retired branch) remain valid,
  per the Foundation module's "soft delete, always" rule.
- FR-CH-4.2 `PATCH /branches/:id/deactivate` sets `isActive: false` on the branch **and every
  descendant** in one call.
- FR-CH-4.3 `PATCH /branches/:id/reactivate` sets `isActive: true` on only the named branch;
  descendants are unaffected and must be reactivated individually if desired.

## FR-CH-5 Tenant Onboarding

- FR-CH-5.1 `POST /platform/tenants` (Platform Admin) may include `adminEmail`; when present,
  the response includes a `temporaryPassword` (generated once, never stored in plaintext) for a
  newly created "Church Administrator" role + user scoped to that tenant with every non-platform
  permission code.
- FR-CH-5.2 `GET /tenant` (tenant-scoped) returns the current user's own tenant profile,
  including `onboardedAt`.
- FR-CH-5.3 `PATCH /tenant/onboarding/complete` (tenant-scoped) is idempotent: if the tenant has
  no branches yet, it creates a headquarters branch (defaulting to the tenant's name and type
  `headquarters`); it then sets `onboardedAt` if not already set. Calling it again after
  onboarding is already complete is a no-op that returns the current tenant unchanged.

## FR-CH-6 Non-Functional

- FR-CH-6.1 All branch mutations go through the same `@Permissions(...)` guard and tenant
  scoping (`TenantContextMiddleware` + the Prisma tenant-scoping extension) as every other
  Foundation-module resource — no new cross-cutting mechanism is introduced.
- FR-CH-6.2 New permission codes introduced by this module: `branch.create`, `branch.read`,
  `branch.update`, `branch.move`, `tenant.profile.read`, `tenant.profile.update`.
