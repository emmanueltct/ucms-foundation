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
- FR-2.8 `X-Tenant-Slug` is optional on `POST /auth/login`. Given, it behaves exactly as FR-2.1-2.7
  describe. Omitted, every active tenant is searched for a `User` row matching `email` (and, if
  more than one tenant has that email, `password` too, checked before disambiguating): zero
  matches is rejected the same as a wrong password (`401 INVALID_CREDENTIALS`, never revealing
  whether the email exists anywhere); exactly one match logs in directly; more than one returns
  `{ requiresWorkspaceSelection: true, workspaces: [{ slug, name }] }` instead of a session, so
  the caller can resubmit with `X-Tenant-Slug` set to the chosen workspace.
- FR-2.9 `POST /auth/switch-tenant` (authenticated) re-issues a session for a different tenant
  the caller's email has an active account in, without re-checking the password. Rejected with
  `403 NOT_A_MEMBER` if no such account exists. `GET /auth/workspaces` lists every tenant the
  current user's email has an active account in, for a workspace switcher UI.
- FR-2.10 `POST /auth/forgot-password` (not tenant-scoped, rate-limited 5/60s) always returns the
  same generic success message. For every active account matching the email across every tenant,
  a single-use `PasswordResetToken` (30-minute expiry) is created and an email is dispatched
  through the Communication module's queue. `POST /auth/reset-password` (not tenant-scoped)
  validates the token, updates the password, marks the token used, and revokes every refresh
  token for that user.
- FR-2.11 Registration additionally creates a single-use `EmailVerificationToken` (48-hour
  expiry) and dispatches a verification email; a dispatch failure never fails registration itself.
  `POST /auth/verify-email` (not tenant-scoped) validates the token and sets
  `User.emailVerifiedAt`. `POST /auth/resend-verification` (authenticated) re-sends it.
  `emailVerifiedAt` is informational only — nothing gates on it (see design decision in
  `docs/business-analysis.md`).
- FR-2.12 `POST /auth/mfa/setup` (authenticated) generates a TOTP secret and QR code, unenforced
  until confirmed via `POST /auth/mfa/enable` with a valid current code. Once `mfaEnabled` is
  true, login without an `mfaCode` is rejected with `401 MFA_REQUIRED`; an invalid code is
  rejected with `401 MFA_INVALID`. `POST /auth/mfa/disable` also requires a valid current code.

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
- FR-6.4 Every tenant-scoped Prisma query must include `tenantId` — enforced structurally by a
  Prisma Client Extension (`tenant-scoping.extension.ts`) that auto-injects it from request
  context and throws if neither an explicit `tenantId` nor an active context exists. The one
  deliberate, narrow exception is `PrismaService.unscoped` — a second, un-extended client used
  only for the cross-tenant identity lookups login-by-email, password reset, and email
  verification legitimately need (see FR-2.8/2.10/2.11); it must never be used to read or write
  tenant-owned business data.
