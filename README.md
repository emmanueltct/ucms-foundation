# UCMS — Foundation through Document Management (Modules 0-12) + Custom Fields

Multi-tenancy, Authentication (RBAC + PBAC), the Configuration Engine, Church &
Hierarchy Management, Member & Family Management, Finance, Attendance, Ministry &
Volunteer Management, Communication, Events, HR & Payroll, Reports & Analytics,
Asset & Facility Management, Visitor & Follow-up Management, Document
Management, and a cross-cutting Custom Fields module for the Unified Church
Management System. Module 0 (Foundation), Module 1 (Church & Hierarchy),
Module 2 (Member & Family Management), Module 3 (Finance), Module 4
(Attendance), Module 5 (Ministry & Volunteer Management), Module 6
(Communication), Module 7 (Events), Module 8 (HR & Payroll), Module 9 (Reports
& Analytics), Module 10 (Asset & Facility Management), Module 11 (Visitor &
Follow-up Management), and Module 12 (Document Management) are complete —
everything else builds on top of what's here.

Custom Fields (`docs/custom-fields/`) is not numbered as its own module — it's a
cross-cutting mechanism, wired into Member & Family Management today, that lets a
Church Administrator add entirely new fields to a form (not just new dropdown
values) with zero code changes. See design decision #17 below.

## What's included

```
docs/
  business-analysis.md         Module 0: why it exists, actors, business rules
  functional-requirements.md   Module 0: FR-1 .. FR-6, testable requirements
  api-design.md                Module 0: full endpoint reference + error codes
  church-hierarchy/            Module 1 docs (business analysis, FRs, API design)
  member-management/           Module 2 docs (business analysis, FRs, API design)
  finance/                     Module 3 docs (business analysis, FRs, API design)
  attendance/                  Module 4 docs (business analysis, FRs, API design)
  ministry/                    Module 5 docs (business analysis, FRs, API design)
  communication/               Module 6 docs (business analysis, FRs, API design)
  events/                      Module 7 docs (business analysis, FRs, API design)
  hr-payroll/                  Module 8 docs (business analysis, FRs, API design)
  reports/                     Module 9 docs (business analysis, FRs, API design)
  asset-management/            Module 10 docs (business analysis, FRs, API design)
  visitor-management/          Module 11 docs (business analysis, FRs, API design)
  document-management/         Module 12 docs (business analysis, FRs, API design)
  custom-fields/               Cross-cutting module docs (business analysis, FRs, API design)

prisma/
  schema.prisma                Tenant, User, Role, Permission, ConfigItem, Branch, Member,
                                Family, Contribution, AttendanceRecord, Ministry,
                                MinistryMembership, Notification, CustomFieldDefinition,
                                CustomFieldValue, Event, EventRegistration, Staff,
                                PayrollPayment, Asset, Visitor, VisitorFollowUp, Document, ...

backend/                       NestJS API
  src/
    common/                    Tenant middleware, guards, decorators, filters,
                                AsyncLocalStorage tenant-context store
    prisma/                    PrismaService + tenant-scoping Client Extension
                                (auto-scopes/enforces tenantId on every query)
    queue/                     BullMQ/Redis queue wiring; NotificationsProcessor now
                                updates Notification.status (sent/failed) on completion —
                                the first real consumer of this pipeline
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
    finance/                   Contribution recording against a Branch and (optionally) a
                                Member; corrected by voiding with a reason, never edited
                                or deleted; totals-by-type summary endpoint
    attendance/                Attendance recording — a named member's check-in (always
                                counts as 1) or an anonymous head-count; corrected in place
                                or soft-deleted (plain rule, unlike Finance's void-only one);
                                totals-by-service-type summary endpoint
    ministries/                Ministries (flat, optionally branch-scoped) + volunteer
                                memberships (Member<->Ministry with a role — leadership is
                                just a role value, not a denormalized field); deleting a
                                ministry deactivates its memberships
    communication/             Notification history (email/sms/push) — creates a durable
                                record, then dispatches async via the queue; recipient
                                resolves from an explicit address or a member's profile;
                                real gateway delivery is a documented stub
    custom-fields/             Cross-cutting: CustomFieldDefinitionsService (CRUD, mirrors
                                ConfigItem's API shape) + CustomFieldsService (the reusable
                                get/set-values service other modules inject). Wired into
                                Members today as the flagship integration.
    events/                    Events (flat, optionally branch-scoped) + registrations
                                (named member or walk-in guest, soft capacity cap enforced
                                at registration time); deleting an event cancels its
                                registrations
    hr/                        Staff records (always the person's own record, never an
                                optional-FK-with-fallback the way Contribution/Attendance/
                                EventRegistration are) + PayrollPayment, a pending -> paid |
                                cancelled lifecycle guarded the same way Finance guards a
                                Contribution — never edited once paid or cancelled
    reports/                   Cross-cutting, read-only aggregation over Finance/Attendance/
                                Member/Event/HR & Payroll data — no Prisma models of its own;
                                month-bucketed trends are zero-filled, guarded by a single
                                `reports.view` permission
    assets/                    Assets (buildings, vehicles, equipment, ...) under a
                                tenant-configurable category; Custom Fields is reused with a
                                composed entityType (`asset:{category}`) so each category gets
                                its own field set with zero new tables, including a new `file`
                                fieldType for document uploads (proof of purchase, insurance,
                                ...) routed through the Storage module
    visitors/                  Visitors tracked from first contact through an append-only
                                follow-up log (VisitorFollowUp) to (optionally) becoming a
                                Member — `status` is a plain lifecycle field except "joined",
                                which only ever happens via the dedicated `convert` action
                                that links `convertedMemberId`
    documents/                 Documents (policies, minutes, forms, certificates, ...) —
                                unlike Assets' `file`-type custom fields, a Document *is* the
                                record, so metadata + file upload happen together in one
                                POST call; a document's id is pre-generated (`randomUUID`) so
                                the storage key can be namespaced by it without a second
                                round trip. Shares its MIME allowlist/size cap with Assets via
                                `common/constants/file-upload.constants.ts`.
    users/                     Tenant-scoped user management
    roles/                     Tenant-defined roles built from the permission catalog
    permissions/                Global, read-only permission catalog
    config-engine/             The generic configuration engine (ministries,
                                contribution types, ceremony names, membership
                                categories, feature toggles — all as data)
  prisma/seed.ts                Seeds the permission catalog, a demo tenant, branch
                                types, membership categories, contribution types, service
                                types, attendance methods, ministry types, event types,
                                staff positions, departments, asset categories, asset
                                conditions, visitor sources, follow-up methods, document
                                categories, example asset:vehicle/asset:building custom
                                fields (including two file-upload fields), two example
                                member custom fields, and a headquarters branch
  test/                         Unit tests (auth, guards, config, queue, storage,
                                tenant scoping, MFA, branches, families, members,
                                tenant profile, finance, attendance, ministries,
                                notifications, custom fields, events, staff, payroll,
                                reports, assets, visitors, documents) + e2e auth flow

frontend/                      Next.js 14 + Tailwind v4 + shadcn/ui
  app/page.tsx                   Public landing page (denominations, live modules, CTAs)
  app/login/page.tsx            Tenant-aware sign-in
  app/admin/layout.tsx           Shared sidebar shell for every /admin/* page
  app/admin/page.tsx             Dashboard — live counts + jump-off cards into each module
  app/admin/reports/page.tsx     Reports & Analytics dashboard — recharts-based trend charts
                                  over Finance/Attendance/Membership/Payroll, computed live
  app/admin/config/page.tsx      Church Admin UI for the Configuration Engine
  app/admin/branches/page.tsx    Church Admin UI for the organizational hierarchy tree
  app/admin/members/page.tsx     Church Admin UI for members — renders this tenant's
                                  custom fields dynamically alongside the fixed ones
  app/admin/finance/page.tsx     Church Admin UI for recording/voiding contributions
  app/admin/attendance/page.tsx  Church Admin UI for check-ins and head-counts
  app/admin/ministries/page.tsx  Church Admin UI for ministries and volunteer rosters
  app/admin/events/page.tsx      Church Admin UI for events and registrations (member or guest)
  app/admin/hr/page.tsx          Church Admin UI for staff records and payroll payments —
                                  master-detail layout (staff list, selected staff's payroll
                                  history) with position/department dropdowns sourced from
                                  ConfigItems
  app/admin/assets/page.tsx      Church Admin UI for the asset register — category-driven
                                  create form (custom fields render dynamically per selected
                                  category) + master-detail list with in-place status changes
                                  and per-field document upload/download
  app/admin/visitors/page.tsx     Church Admin UI for visitors — master-detail layout
                                  (visitor list, selected visitor's follow-up timeline) with
                                  in-place status changes and a convert-to-member action
  app/admin/documents/page.tsx    Church Admin UI for documents — upload (title/category/
                                  branch + file in one form), category/search filtering,
                                  download, and in-place file replacement
  app/admin/notifications/page.tsx Church Admin UI for sending/reviewing notifications
  app/admin/settings/custom-fields/page.tsx  Define custom fields per entity type — asset
                                  categories appear here automatically as `asset:{category}`
                                  entity types, sourced from the asset_category ConfigItems
  app/onboarding/page.tsx        First-run wizard (headquarters name -> complete onboarding)
  components/admin-nav.tsx       The sidebar nav consumed by app/admin/layout.tsx
  components/dynamic-custom-fields.tsx  Renders whatever fields GET
                                  /custom-field-definitions returns — the form-side half
                                  of the Custom Fields mechanism
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

**Redis must be reachable for the API to start at all** — `QueueModule`
registers a BullMQ queue at boot. It now fails within ~15s with a clear
"UCMS API failed to start... Redis" message instead of hanging forever
(`connectTimeout` + a bounded `retryStrategy` in `queue.module.ts`, plus a
`bootstrap().catch()` in `main.ts` that logs and exits) — if you see that
message, Redis isn't reachable at `REDIS_URL`. On Windows without Docker,
the least-friction option is [Memurai](https://www.memurai.com/get-memurai)
(installs as a native Windows service on port 6379); WSL2 + `redis-server`
also works. An S3-compatible store (MinIO locally) does *not* block startup
— the S3 client only connects when something actually uploads/downloads a
file.

Demo login (from the seed script): tenant `demo-church`,
`admin@demo-church.test` / `ChangeMe123`.

```bash
# sanity check
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: demo-church" \
  -d '{"email":"admin@demo-church.test","password":"ChangeMe123"}'
```

## Running the frontend locally (without Docker)

In a second terminal, with the backend already running:

```bash
cd frontend
cp .env.example .env       # NEXT_PUBLIC_API_BASE, defaults to http://localhost:3000/api/v1
npm install
npm run dev                # http://localhost:3001
```

Visit `http://localhost:3001` for the public landing page, `/login` to sign in with the
demo credentials above, then `/admin` for the dashboard — every admin page after that
shares one sidebar shell (`app/admin/layout.tsx`). Auth tokens are kept in-memory only
(not `localStorage`, see the note in `lib/api.ts`), so sign in and navigate within the
same browser tab/session rather than opening admin pages directly by URL in a fresh tab.

## Running tests

```bash
cd backend
npm test                     # unit tests (auth/MFA, PBAC guard, config, queue, storage, tenant scoping, branches, families, members, finance, attendance, ministries, notifications, custom fields, events, staff, payroll, reports, assets, visitors, documents)
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
10. **Financial records are voided, never edited or deleted — a stronger
    variant of "soft delete, always."** There is no `deletedAt` on
    `Contribution` and no way to change its amount/type/branch/member after
    the fact; a mistake is corrected via `PATCH /contributions/:id/void`
    with a mandatory reason (`isVoided`, `voidedAt`, `voidReason`,
    `voidedByUserId`), and voided records are excluded from
    `GET /contributions/summary` totals unless `includeVoided=true` is
    passed explicitly. Only `notes`/`receiptNumber` are mutable in place, since
    they carry no financial meaning of their own. See
    `docs/finance/business-analysis.md` for the full rationale.
11. **Not every module needs Finance's strict voiding pattern — pick the rule
    that matches what's actually at stake.** `AttendanceRecord` reuses the
    Foundation module's plain "soft delete, always" rule (rule #4): a
    mis-typed head-count can be corrected in place via `PATCH` or removed
    outright via `DELETE`, unlike a `Contribution`, which can only be voided.
    Whether a new module needs the stronger pattern depends on whether the
    record carries an audit-trail obligation the way money does — see
    `docs/attendance/business-analysis.md` for the comparison.
12. **A named individual and an anonymous bulk entry share one table via an
    optional FK, with different rules attached to each side.** Like
    `Contribution.memberId`, `AttendanceRecord.memberId` is optional — but
    where an absent `memberId` on a contribution just means "anonymous
    giving," on an attendance record it flips the validation rules entirely
    (`headcount` forced to 1 vs. required and caller-supplied) and exempts
    the record from the duplicate-check uniqueness rule (FR-ATT-1.6) that
    applies to named check-ins.
13. **Ministries stayed flat — the tree pattern isn't reused everywhere just
    because it exists.** `Ministry` doesn't borrow `Branch`'s self-referencing
    tree; nothing in the platform's brief calls for sub-ministry nesting the
    way Church & Hierarchy explicitly does for branches, so it's a flat
    entity like `Family`. Reuse a pattern because a module's actual
    requirements call for it, not merely because a similar-looking one
    exists elsewhere.
14. **A many-to-many relationship's "special" side is a role value, not a
    denormalized column.** `MinistryMembership.role = "leader"` marks
    leadership — there's no `Ministry.leaderId` the way `Family` has
    `headOfFamilyId`. The difference: a family can only reasonably have one
    head (worth a unique FK + auto-clear logic), but a ministry can
    reasonably have co-leaders, so a plain role value with no uniqueness
    constraint is the better fit. See `docs/ministry/business-analysis.md`.
15. **A record's status can change after creation from outside any HTTP
    request — that worker code needs its own tenant-scoping discipline.**
    `NotificationsProcessor` runs as a BullMQ job handler, not behind
    `TenantContextMiddleware`, so the `AsyncLocalStorage` context the Prisma
    tenant-scoping extension reads is simply absent there. It passes
    `tenantId` explicitly in every `where` clause instead of relying on the
    extension's auto-injection. Any future queue-driven worker needs the
    same discipline — the extension only protects code that runs inside a
    request.
16. **A stubbed integration should have exactly one seam, clearly marked.**
    `NotificationsProcessor.process` is the single place a real SMS/Email/
    Push gateway call would go; everything around it (the `Notification`
    record, the queue, the status transitions, the API) is fully real and
    already tested. When wiring a real provider later, only that one method
    should need to change.
17. **"Everything must be configurable" has two distinct levels — know which
    one a request is actually asking for.** Modules 1-6 all made dropdown
    *values* tenant-configurable (`ConfigItem` rows: contribution types,
    ministry types, branch types, ...) — the *fields themselves* were still
    fixed in the schema. The Custom Fields module (`backend/src/custom-fields/`,
    `docs/custom-fields/`) is the other level: a tenant can add whole new
    *fields* to a form (`CustomFieldDefinition` + `CustomFieldValue`, an
    EAV-style pair keyed by a free-string `entityType` so a new entity never
    needs a migration here). Wired into Member & Family Management as the
    flagship integration; extending it to Finance/Attendance/Ministry is a
    mechanical repeat of the same three calls (`assertRequiredFieldsProvided`
    → create → `setValues`, plus `getValues`/`getValuesForMany` on reads),
    not a redesign.
18. **A worker-scoped resource ("a definition") and a request-scoped one
    ("a value the caller supplied") don't need the same permission axis.**
    `customfield.definition.*` guards defining/editing fields; there is no
    separate `customfield.value.*` permission — writing a value is covered
    by whatever permission already guards the record it belongs to
    (`member.create` covers a member's custom field values too). Don't
    invent a new permission axis just because a new table exists.
19. **A status field can replace `deletedAt`/`isActive` when the record
    already has a natural lifecycle.** `EventRegistration.status`
    (`registered` → `attended` | `cancelled`) is how "soft delete, always"
    (rule #4) shows up here — cancelling sets `status: "cancelled"` rather
    than adding a `deletedAt` column, since the record needed a status field
    anyway. Don't add a second "is this gone" mechanism when one already
    exists; pick whichever the entity's own shape calls for.
20. **A duplicate-check that makes sense for one side of an optional FK can
    be meaningless for the other.** `EventRegistration` cannot enforce
    "already registered" for a guest the way it does for a `memberId` — a
    guest has no stable identifier to de-duplicate against. This is the
    same asymmetry `AttendanceRecord.memberId` already established (rule
    #12), applied to a third module: the validation rule that makes sense
    for a named record doesn't always have an equivalent for its anonymous
    counterpart, and forcing one anyway (e.g. de-duping guests by name)
    would reject legitimate same-name registrations.
21. **Not every person-shaped record is an optional-FK-with-fallback —
    some are always their own record.** Unlike `Contribution.memberId`,
    `AttendanceRecord.memberId`, or `EventRegistration.memberId`+`guestName`
    (rule #12), `Staff` has no anonymous-fallback side: it always has its
    own `firstName`/`lastName`, and `memberId` is an *optional pointer back*
    to a `Member` (for staff who are also congregants), not the identity
    itself. `PayrollPayment` then reuses Finance's stricter pattern (rule
    #10) rather than Attendance's plain one (rule #11): once a payment is
    `paid` or `cancelled` it cannot be edited, only inspected — the same
    "money needs an audit trail" reasoning as `Contribution.isVoided`,
    expressed here as a `pending -> paid | cancelled` status lifecycle
    (rule #19's pattern) instead of a boolean. See
    `docs/hr-payroll/business-analysis.md` for the full rationale.
22. **Not every module needs a table — a reporting layer over existing data is
    a service, not a schema.** `backend/src/reports/` introduces zero Prisma
    models; `ReportsService` reads `Contribution`/`AttendanceRecord`/`Member`/
    `Event`/`Staff`/`PayrollPayment` directly, tenant-scoped the same as
    everywhere else, and month-buckets in JS rather than a database-level
    `date_trunc` groupBy so the codebase stays on plain Prisma Client calls
    (no raw SQL) — fine at single-tenant data volumes, and an isolated,
    swappable seam if a tenant's history ever outgrows it. One permission,
    `reports.view`, guards every endpoint — these are read-only aggregates,
    not separately-owned records, so there's no reason to split it further
    the way `staff.*` and `payroll.payment.*` are split by action. See
    `docs/reports/business-analysis.md` for the full rationale.
23. **A cross-cutting mechanism can be reused in a new way without changing
    its own shape.** Custom Fields' `entityType` was already "a free string,
    not an enum" (rule #17) — Asset & Facility Management (Module 10) composes
    it as `asset:{assetCategory}` instead of a fixed constant, so each
    tenant-defined asset category (vehicle, building, ...) gets its own field
    set from the exact same `CustomFieldDefinition`/`CustomFieldValue` tables
    Member & Family Management already uses. Nothing about the Custom Fields
    module changed to make this possible — only the string an integrating
    module passes it. See `docs/asset-management/business-analysis.md`.
24. **A field type is a small, well-understood axis to extend; a value's
    *meaning* is not something this module tries to police.** Custom Fields
    gained a sixth `fieldType`, `file` — introduced for Asset & Facility
    Management's document uploads (proof of purchase, insurance, title
    deeds) — validated the same lightweight way every other type is: a
    `file` value must be shaped `{ key, filename }`, a reference to an
    object the *integrating* module already uploaded to the Storage module.
    Custom Fields never touches the binary or talks to S3 itself; `Asset`'s
    own `POST /assets/:id/documents` endpoint is where the upload, the MIME
    allowlist, and the size cap actually live — the same "one seam, clearly
    marked" discipline rule #16 established for the queue's stubbed gateway.
25. **Some fields are only meaningful once the parent record exists, and
    that's fine to surface in the form itself.** A brand-new asset has no
    `id` yet, so `file`-type custom fields can't be uploaded during
    creation (the storage key is namespaced by the record's id). Rather
    than warping the create flow to upload-then-attach, `DynamicCustomFields`
    just shows "save first, then upload" for a `file` field when no
    `entityId` is known yet, and becomes a working upload/download control
    the moment one is — the same shape the rest of this platform already
    uses for a two-step "create, then attach children" flow (a `PayrollPayment`
    needs a `Staff` id, an `EventRegistration` needs an `Event` id).
26. **A record that turns into a different kind of record gets one dedicated
    action, not a status value you can set directly.** `Visitor.status` is a
    plain, freely-editable field (rule #19's pattern) for every transition
    except `"joined"` — setting that one directly is rejected
    (`400 VISITOR_USE_CONVERT_ENDPOINT`) because it has a real side effect
    (linking `convertedMemberId`) that a bare field edit can't safely
    express. `PATCH /visitors/:id/convert` takes an *existing* `memberId`
    rather than creating the `Member` itself — reusing Member & Family
    Management's own validation instead of building a second, parallel
    "create a member" path that would drift from the real one. The same
    "a field with real side effects earns its own endpoint" reasoning as
    `Member.transfer` (rule #8) and `Family.setHead`, applied to a
    cross-module conversion instead of a same-module field.
27. **An append-only interaction log doesn't need — and shouldn't offer —
    an edit or delete path.** `VisitorFollowUp` rows are never updated or
    removed once logged, the same "history doesn't get rewritten" shape
    `AuditLog` already has; a correction is a new entry, not a mutation of
    an old one. Not every child record needs `PATCH`/`DELETE` just because
    `PayrollPayment` or `EventRegistration` have them — it depends on
    whether the record represents a fact that already happened (a follow-up
    call) or a piece of state with a legitimate "undo" (a pending payment).
28. **Not every "attach a file to something" need is Custom Fields' `file`
    type — it depends on whether the file *is* the record or sits on
    someone else's.** Asset & Facility Management's `file`-type custom
    fields (rule #24) exist because a document there is one small
    attachment on an `Asset`, needing that asset's id first. Document
    Management's `Document`, by contrast, *is* the record — so its
    `POST /documents` takes metadata and the file together in one call, with
    the row's id generated client-side (`randomUUID()`) before the row
    exists so the storage key can be namespaced by it without a second
    round trip. Two different shapes for "upload a file," chosen by what the
    file's relationship to the rest of the data actually is, not by copying
    whichever pattern was built most recently. The MIME allowlist and size
    cap themselves *are* shared (`common/constants/file-upload.constants.ts`)
    since that concern — "what's an acceptable uploaded file" — is genuinely
    the same question in both modules.

## Recent hardening (this pass)

- **Redis now fails fast, not silently forever.** `queue.module.ts` adds a
  bounded `retryStrategy` + `connectTimeout`, and `main.ts` wraps `bootstrap()`
  in a `.catch()` that prints an actionable message before exiting — this is
  what you'll see instead of a silent hang if `REDIS_URL` is unreachable.
- **A shared admin shell.** `app/admin/layout.tsx` + `components/admin-nav.tsx`
  wrap every `/admin/*` page in one persistent sidebar (with active-route
  highlighting) instead of a set of pages only reachable by typing a URL.
  `app/admin/page.tsx` is a new dashboard landing spot with live counts and
  jump-off cards into every module.

## Next module

Modules 0-12 (Foundation through Document Management) plus the cross-cutting
Custom Fields mechanism are complete. What's left from the platform's full
36-module brief — small groups (Sunday School / children's ministry, Small
Groups) and the optional/AI-assisted features explicitly deferred to the end
in the original roadmap — builds on the same established patterns (tenant
scoping, `ConfigItem` for types, permission-guarded controllers, soft delete
or the stricter void/status pattern where money or an audit trail is
involved, Custom Fields' `entityType` composition trick where a module needs
per-category or per-type fields the way Assets did, the "dedicated conversion
endpoint reusing an existing module's validation" pattern Visitors
established for turning into a Member, and the shared file-upload constants
Document Management factored out — Small Groups' own "graduate to
membership"-style flows, if any, can reuse the same shapes).
