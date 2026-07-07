# UCMS — Foundation, Church Hierarchy & Member Management

Multi-tenancy, Authentication (RBAC + PBAC), the Configuration Engine, Church &
Hierarchy Management, and Member & Family Management for the Unified Church Management
System. Module 0 (Foundation), Module 1 (Church & Hierarchy), and Module 2 (Member &
Family Management) are complete — everything else (Finance, Attendance, Communication,
...) builds on top of what's here.

## What's included

```
docs/
  business-analysis.md         Module 0: why it exists, actors, business rules
  functional-requirements.md   Module 0: FR-1 .. FR-6, testable requirements
  api-design.md                Module 0: full endpoint reference + error codes
  church-hierarchy/            Module 1 docs (business analysis, FRs, API design)
  member-management/           Module 2 docs (business analysis, FRs, API design)

prisma/
  schema.prisma                Tenant, User, Role, Permission, ConfigItem, Branch, Member, Family, ...

backend/                       NestJS API
  src/
    common/                    Tenant middleware, guards, decorators, filters,
                                AsyncLocalStorage tenant-context store
    prisma/                    PrismaService + tenant-scoping Client Extension
                                (auto-scopes/enforces tenantId on every query)
    queue/                     BullMQ/Redis queue wiring (notifications skeleton
                                for the future Communication module)
    storage/                   S3-compatible object storage (logos, photos,
                                receipts, asset docs)
    auth/                      register/login/refresh/logout, JWT strategies,
                                TOTP MFA enroll/verify
    tenants/                   Platform-admin tenant provisioning (+ optional admin-user
                                bootstrap), and the tenant's own profile/onboarding-complete
                                endpoints
    branches/                  Church & Hierarchy Management — self-referencing branch
                                tree, ancestors/descendants, move (cycle-checked),
                                cascading deactivate
    members/                   Member profiles attached to a Branch; transfer between
                                branches (cycle-free, so it's a plain move+validate)
    families/                  Family/household grouping — flat (no hierarchy), head
                                of family, non-cascading deactivate/delete
    users/                     Tenant-scoped user management
    roles/                     Tenant-defined roles built from the permission catalog
    permissions/                Global, read-only permission catalog
    config-engine/             The generic configuration engine (ministries,
                                contribution types, ceremony names, membership
                                categories, feature toggles — all as data)
  prisma/seed.ts                Seeds the permission catalog, a demo tenant, branch
                                types, membership categories, and a headquarters branch
  test/                         Unit tests (auth, guards, config, queue, storage,
                                tenant scoping, MFA, branches, families, members,
                                tenant profile) + e2e auth flow

frontend/                      Next.js 14 + Tailwind v4 + shadcn/ui
  app/login/page.tsx            Tenant-aware sign-in
  app/admin/config/page.tsx      Church Admin UI for the Configuration Engine
  app/admin/branches/page.tsx    Church Admin UI for the organizational hierarchy tree
  app/admin/members/page.tsx     Church Admin UI for members (create, search, transfer)
  app/onboarding/page.tsx        First-run wizard (headquarters name -> complete onboarding)
  components/ui/                shadcn/ui components (button, input, label, card)
  lib/api.ts                     Typed fetch client (standard envelope + tenant header)
  lib/utils.ts                   shadcn's `cn()` class-merging helper

mobile/                        Flutter (auth screens)
  lib/screens/login_screen.dart
  lib/services/auth_service.dart
```

## Running everything with Docker Compose

```bash
docker compose up --build     # postgres, redis, minio, backend, frontend
```

Backend runs its own `prisma migrate deploy` on container start. Seed it once
the containers are up: `docker compose exec backend npm run prisma:seed`.
API: http://localhost:3000/api/v1 — Swagger docs: http://localhost:3000/api/docs
— Frontend: http://localhost:3001 — MinIO console: http://localhost:9001.

## Running the backend locally (without Docker)

```bash
cd backend
cp .env.example .env         # fill in Postgres/Redis/S3 connection details and JWT secrets
npm install
npx prisma migrate dev --name init
npm run prisma:seed          # creates the permission catalog + demo-church tenant
npm run start:dev            # http://localhost:3000/api/v1 (Swagger: /api/docs)
```

Redis and an S3-compatible store (MinIO locally) are required for the queue
and storage modules to connect on boot — see `.env.example` for the expected
`REDIS_URL`/`S3_*` variables. The API itself still starts without them; only
notification jobs and file uploads need them running.

Demo login (from the seed script): tenant `demo-church`,
`admin@demo-church.test` / `ChangeMe123`.

```bash
# sanity check
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: demo-church" \
  -d '{"email":"admin@demo-church.test","password":"ChangeMe123"}'
```

## Running tests

```bash
cd backend
npm test                     # unit tests (auth/MFA, PBAC guard, config, queue, storage, tenant scoping, branches, families, members)
npm run test:e2e             # requires a migrated + seeded test database
```

## Design decisions worth knowing before building the next module

1. **Tenant scoping is structural, not optional.** `TenantContextMiddleware`
   resolves the tenant before any controller runs; every tenant-owned Prisma
   model carries `tenantId`. When you add a new module, filter by the
   `tenantId` from `@CurrentTenantId()` the same way `users` and `roles` do —
   don't invent a different pattern.
2. **Authorization is permission-code-based, not role-name-based.** Add new
   permission codes to the seed's catalog (`module.entity.action` convention)
   and guard routes with `@Permissions(...)`. Never branch business logic on
   a role's *name* — role names are tenant-editable.
3. **New "types" and "categories" belong in the Configuration Engine, not a
   new table.** Finance's contribution types, Events' ceremony names,
   Membership's categories — all of these are `ConfigItem` rows with a new
   `namespace`, following the `contribution_type` example already seeded.
   Only reach for a dedicated table when the data needs its own relations
   (foreign keys, its own audit trail) beyond a label + JSON blob.
4. **Soft delete, always.** `deletedAt` / `isActive` toggles, never hard
   deletes, so historical records (a contribution against a since-retired
   fund, a role a since-removed user once had) stay valid.
5. **Tenant scoping is now also enforced at the Prisma layer, not just by
   convention.** `backend/src/prisma/tenant-scoping.extension.ts` auto-injects
   `tenantId` into `where`/`data` for any query against a tenant-owned model
   that omits it (read from the request's `AsyncLocalStorage` context), and
   throws if neither an explicit `tenantId` nor an active tenant context
   exists. When you add a new tenant-owned model, add it to that extension's
   `TENANT_SCOPED_MODELS` set — otherwise queries against it aren't scoped at
   all.
6. **Organizational structure is one self-referencing tree, not fixed levels.**
   `Branch.parentBranchId` supports arbitrary depth so a flat independent
   church and a multi-level diocese hierarchy use the same model; the branch
   "type" label (parish, district, cell, ...) is a `ConfigItem` in namespace
   `branch_type`, not a hard-coded enum. See
   `docs/church-hierarchy/business-analysis.md` for the full rationale.
7. **Onboarding is a thin wizard over existing endpoints, not a persisted
   state machine.** `PATCH /tenant/onboarding/complete` is the only new
   endpoint — it's idempotent (safe to call more than once) and just
   guarantees a headquarters branch exists before flipping `onboardedAt`.
   There's no `OnboardingProgress` table; don't add one unless a real
   requirement needs the wizard to resume across devices/sessions.
8. **A member belongs to exactly one branch; changing it is a dedicated
   action, not a plain field edit.** `PATCH /members/:id/transfer` mirrors
   Branch's `move` endpoint — it validates the target branch exists in the
   same tenant before changing `branchId`. `PATCH /members/:id` explicitly
   cannot touch `branchId` for the same reason `UpdateBranchDto` can't touch
   `parentBranchId`.
9. **A family is a flat grouping, not a hierarchy — and it does not cascade.**
   Unlike deactivating a `Branch` (which cascades to descendants), deleting or
   deactivating a `Family` never touches its members' `isActive`/`familyId`;
   a family is a label members point to, not a structure they belong to. See
   `docs/member-management/business-analysis.md` for the full rationale,
   including why `Family.headOfFamilyId` is auto-cleared whenever the member
   holding it leaves the family or is soft-deleted.

## Next module

Per the intended build order: **Finance** is next — contribution tracking
(tithes, offerings, building funds) against `Member`s and `Branch`es, with
contribution types as `ConfigItem`s (namespace `contribution_type`, already
seeded), following the same patterns established here.
