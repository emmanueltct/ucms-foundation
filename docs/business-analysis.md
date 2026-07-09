# Module 0: Foundation — Multi-Tenancy, Authentication & Configuration Engine

## 1. Business Description

Every feature in UCMS — finance, membership, attendance, ministries, reports — depends on three
things existing first:

1. **Tenant isolation** — a church (tenant) must never see another church's data, branding, or
   configuration, even though all tenants share the same running application and database.
2. **Identity & access** — users must be able to register/log in, and the system must know
   *which tenant* they belong to and *what they're allowed to do* inside that tenant (RBAC + PBAC).
3. **Configuration, not code** — because denominations differ wildly (a Catholic parish's
   hierarchy looks nothing like an independent Pentecostal ministry's), anything
   church-specific (ministries, contribution types, ceremony names, membership categories,
   feature toggles) must be stored as **data owned by the tenant**, not hard-coded enums.

This module is the load-bearing wall. Every later module (Finance, Membership, Attendance, etc.)
will read the tenant context from the request, check permissions through the same guards, and
store its own "types"/"categories" through the same Configuration Engine rather than inventing a
new one each time.

## 2. Actors

| Actor | Description |
|---|---|
| Platform Admin | Anthropic-of-UCMS staff; manages tenants, plans, and global permission catalog |
| Church Administrator | Owns a tenant; manages users, roles, and configuration for their church |
| Pastor / Priest | Elevated role within a tenant, typically with broad but not platform-wide permissions |
| Ministry Leader | Scoped role, permissions limited to their ministry's data |
| Finance Officer | Scoped role, permissions limited to finance module |
| Member | Lowest-privilege authenticated user, mobile-app-first |

## 3. Key Business Rules

- A `User` **row** belongs to exactly **one tenant** — but the same **person** (identified by
  email) may have a separate `User` row, with its own password and roles, in more than one
  tenant. Nothing links these rows together beyond the shared email; there's no cross-tenant
  "account" entity. Login can route by email alone across every tenant that has a matching row
  (see the Authentication rules below), and an already-authenticated session can switch to a
  different one of those rows without a password prompt. (Platform Admins are still modeled
  separately, outside tenant-scoped `User` concerns entirely — a flag, not a tenant membership.)
- Every table that stores tenant-owned data carries a `tenantId` column and every query is
  automatically scoped to it — enforced at the guard/middleware level so a developer *cannot
  forget* to filter by tenant.
- Roles are **defined per tenant**, but the **catalog of possible permissions** (e.g.
  `finance.contribution.create`) is global and versioned with the platform, so new modules can
  ship new permissions without a migration per tenant.
- A permission check is always "does any of this user's roles in this tenant grant this
  permission code," never a hard-coded role name check (no `if (user.role === 'admin')`
  anywhere in business logic).
- Configuration items (ministries, contribution types, ceremony names, membership categories,
  feature toggles) are stored as tenant-scoped key/value records (`ConfigItem`,
  `FeatureToggle`) with a `namespace` discriminator, so the same generic engine serves every
  future module without new tables.
- Refresh tokens are stored hashed, tenant-scoped, and revocable (logout / logout-all-devices).
- **Login doesn't require knowing a tenant slug up front.** `POST /auth/login`'s `X-Tenant-Slug`
  header is optional — omitted, it routes by email+password alone across every active tenant via
  `PrismaService.unscoped` (a second, deliberately un-extended Prisma client reserved for this
  one legitimate cross-tenant identity lookup; never used to read or write tenant-owned business
  data). Zero matches and a wrong password produce the identical generic `INVALID_CREDENTIALS`
  either way — the flow never reveals whether an email exists anywhere. Exactly one match logs
  straight in; more than one (the same email+password registered at more than one church) returns
  a workspace list instead of a session, so the caller can disambiguate and resubmit with the
  header set. An already-authenticated session can switch to a different workspace the same
  person has an account in via `POST /auth/switch-tenant`, without a password prompt, since a
  valid token for the current tenant already proved identity.
- **Password reset and email verification are both deliberately cross-tenant** for the same
  reason login can be: a person may not remember which church they're registered under. Both use
  single-use, hashed, expiring tokens (`PasswordResetToken` — 30 minutes; `EmailVerificationToken`
  — 48 hours) looked up by token hash alone, never by tenant. A successful password reset revokes
  every refresh token for that user (forces re-login everywhere). Email verification is
  informational only — `User.emailVerifiedAt` is returned to the frontend and shown as a nudge,
  but nothing in the platform gates on it; see rule below.
- Two-factor authentication (TOTP) is enroll-then-confirm: `POST /auth/mfa/setup` issues a secret
  that isn't enforced until confirmed via `POST /auth/mfa/enable` with a real code from the
  authenticator app, so an abandoned setup can never lock someone out. Once enabled, login
  without a code returns `MFA_REQUIRED` rather than failing outright, and the frontend prompts
  for one as a second step.

## 4. Out of Scope for This Module

- **Gating login (or anything else) on `emailVerifiedAt`.** Verification is a nudge today, not
  an enforcement mechanism — deciding what happens to an unverified account after some grace
  period, or whether a Church Administrator needs visibility into who hasn't verified, is a real,
  separate feature nothing in the current requirement calls for yet.
- Billing/subscription enforcement logic (the `subscriptionPlan` field exists on `Tenant` now;
  enforcement middleware ships with the Subscription & Billing module).
- Any business-domain configuration values themselves (e.g. actually seeding "Tithe" as a
  contribution type) — that's for the Finance module. This module only builds the *engine* that
  stores such values.
