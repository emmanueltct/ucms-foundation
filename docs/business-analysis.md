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

- A user account belongs to exactly **one tenant**. (Cross-tenant "super users" are modeled
  separately as Platform Admins, outside the tenant-scoped `User` table concerns — a Platform
  Admin flag, not a tenant membership.)
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

## 4. Out of Scope for This Module

- MFA enrollment UI (schema field `mfaEnabled`/`mfaSecret` is reserved; flow ships with User
  Management module).
- Billing/subscription enforcement logic (the `subscriptionPlan` field exists on `Tenant` now;
  enforcement middleware ships with the Subscription & Billing module).
- Any business-domain configuration values themselves (e.g. actually seeding "Tithe" as a
  contribution type) — that's for the Finance module. This module only builds the *engine* that
  stores such values.
