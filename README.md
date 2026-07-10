# UCMS — Foundation through Member Activities (Modules 0-14) + Custom Fields

Multi-tenancy, Authentication (RBAC + PBAC), the Configuration Engine, Church &
Hierarchy Management, Member & Family Management, Finance, Attendance, Ministry &
Volunteer Management, Communication, Events, HR & Payroll, Reports & Analytics,
Asset & Facility Management, Visitor & Follow-up Management, Document
Management, Small Groups & Children's Ministry, Member Activities & Personal
History, and a cross-cutting Custom Fields module for the Unified Church
Management System. Module 0 (Foundation), Module 1 (Church & Hierarchy),
Module 2 (Member & Family Management), Module 3 (Finance), Module 4
(Attendance), Module 5 (Ministry & Volunteer Management), Module 6
(Communication), Module 7 (Events), Module 8 (HR & Payroll), Module 9
(Reports & Analytics), Module 10 (Asset & Facility Management), Module 11
(Visitor & Follow-up Management), Module 12 (Document Management), Module 13
(Small Groups & Children's Ministry), and Module 14 (Member Activities &
Personal History) are complete — what's left is the optional/AI-assisted
feature set explicitly deferred to the end of the original roadmap, plus a
set of cross-cutting hardening passes described below.

Custom Fields (`docs/custom-fields/`) is not numbered as its own module — it's a
cross-cutting mechanism, wired into Member & Family Management (and, per-category,
Assets) today, that lets a Church Administrator add entirely new fields to a form
(not just new dropdown values) with zero code changes. It has since grown into a
small form-builder: fields can be grouped into sections, ordered, restricted to
certain roles, given validation rules, and now come in 19 types (including
richtext, image/video/audio/signature uploads, and cross-record lookups). See
design decisions #17 and #30 below.

Authentication has also grown past the original single-tenant login: the same
email can have an account in more than one church, login can route by
email+password alone without knowing which one up front, an authenticated
session can switch between them, and password reset / email verification are
both handled as cross-tenant flows for the same reason. See design decision #31.

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
  small-groups/                Module 13 docs (business analysis, FRs, API design)
  member-activities/           Module 14 docs (business analysis, FRs, API design)
  governance/                  Module 15 docs (business analysis, FRs, API design) —
                                Audit Service, Approval Workflows, Deadlines
  hierarchy-requirements/      Module 16 docs (business analysis, FRs, API design) —
                                configurable requirements between organizational levels
  custom-fields/               Cross-cutting module docs (business analysis, FRs, API design)

prisma/
  schema.prisma                Tenant, User, Role, Permission, ConfigItem, Branch, Member,
                                Family, Contribution, AttendanceRecord, Ministry,
                                MinistryMembership, Notification, CustomFieldDefinition,
                                CustomFieldValue, Event, EventRegistration, Staff,
                                PayrollPayment, Asset, VisitorGroup, Visitor, VisitorActivity,
                                Document, DocumentVersion, SmallGroup, SmallGroupMembership,
                                MemberActivity, ApprovalWorkflow, ApprovalStep,
                                ApprovalRequest, Deadline, User.assignedBranchId,
                                HierarchyRequirement, HierarchyRequirementSubmission, ...

backend/                       NestJS API
  src/
    common/                    Tenant middleware, guards, decorators, filters,
                                AsyncLocalStorage tenant-context store, exports/export.util.ts
                                (CSV by hand; XLSX via exceljs; PDF via pdfkit — one shared
                                helper every export endpoint calls); branch-scope/
                                (BranchScopeService — organizational visibility roll-up,
                                reusing BranchesService.findDescendants);
                                guards/requires-audit-reason.guard.ts +
                                decorators/requires-audit-reason.decorator.ts (mandatory-
                                comment enforcement, same metadata+guard shape as
                                @Permissions()); dto/require-reason.dto.ts
    audit/                     AuditService — generalizes what used to be AuthService's
                                private audit() helper (login/logout/MFA only) into shared,
                                injectable infrastructure any module calls; AuditLog gained
                                reason/previousValue/newValue as first-class columns
    approval-workflows/        Tenant-defined, ordered approval chains (ApprovalWorkflow/
                                Step/Request) reused by member registration, Dynamic Module
                                status transitions, and hierarchy requirement submissions —
                                one generic engine, not three bespoke ones. Deliberately
                                linear, not an arbitrary state-machine/BPMN engine
    deadlines/                 Configurable submission deadlines against any (entityType,
                                entityId) pair. "Locked" is derived at read time from dueAt
                                vs. now (DeadlinesService.effectiveStatus), never stored —
                                no cron needed just to flip a flag. extend/close/reopen are
                                separately-permissioned dedicated actions
    hierarchy-requirements/    A parent branch type's requirement of a child branch type
                                (reports/documents/forms/activities/compliance), plus each
                                child branch's submissions against it. Deadlines and approval
                                chains are resolved by key against approval-workflows/
                                deadlines rather than duplicated; notifies role-holders by
                                email when a new cycle opens
    prisma/                    PrismaService + tenant-scoping Client Extension
                                (auto-scopes/enforces tenantId on every query)
    queue/                     BullMQ/Redis queue wiring; NotificationsProcessor now
                                updates Notification.status (sent/failed) on completion —
                                the first real consumer of this pipeline
    storage/                   S3-compatible object storage (logos, photos,
                                receipts, asset docs)
    auth/                      register/login/refresh/logout, JWT strategies,
                                TOTP MFA enroll/verify, email-first/multi-workspace
                                login + switch-tenant, forgot/reset-password, email
                                verification — all via `PrismaService.unscoped` where
                                the tenant genuinely isn't known yet. Every issued
                                RefreshToken now carries the request's User-Agent/IP;
                                GET /auth/sessions + DELETE /auth/sessions/:id give
                                self-service device management, GET /auth/login-history
                                surfaces recent login/failed-login/logout/switch-tenant
                                events from AuditLog
    tenants/                   Platform-admin tenant provisioning (+ optional admin-user
                                bootstrap), and the tenant's own profile/onboarding-complete
                                endpoints
    branches/                  Church & Hierarchy Management — self-referencing branch
                                tree, ancestors/descendants, move (cycle-checked),
                                cascading deactivate
    members/                   Member profiles attached to a Branch; transfer between
                                branches (cycle-free, so it's a plain move+validate);
                                MemberActivitiesService logs a tenant-configurable activity
                                (sacraments, trainings, certificates, leadership appointments,
                                ...) per member (member_activity:{type} composed Custom Fields);
                                GET /members/export downloads the list as CSV/XLSX/PDF
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
                                `reports.view` permission. Also serves the per-member
                                activity-history timeline, merging Ministries/Small Groups/
                                Events/Attendance/Contributions/MemberActivity into one list.
                                Each summary has a GET .../export sibling (?format=csv|xlsx|pdf)
                                that re-serializes the same computed buckets, never a separate
                                export-specific query
    assets/                    Assets (buildings, vehicles, equipment, ...) under a
                                tenant-configurable category; Custom Fields is reused with a
                                composed entityType (`asset:{category}`) so each category gets
                                its own field set with zero new tables, including a new `file`
                                fieldType for document uploads (proof of purchase, insurance,
                                ...) routed through the Storage module
    visitors/                  Individual Visitors and VisitorGroups (families, delegations,
                                choir/youth visits, conference parties, mission teams), each
                                tracked through an append-only, tenant-configurable
                                VisitorActivity log (visitor_activity:{type} composed Custom
                                Fields, the same asset:{category} trick Assets uses) to,
                                for individuals, (optionally) becoming a Member — `status` is
                                a plain lifecycle field except "joined", which only ever
                                happens via the dedicated `convert` action that links
                                `convertedMemberId`; GET /visitors/export downloads the list
                                as CSV/XLSX/PDF
    documents/                 Documents (policies, minutes, forms, certificates, ...) —
                                unlike Assets' `file`-type custom fields, a Document *is* the
                                record, so metadata + file upload happen together in one
                                POST call; a document's id is pre-generated (`randomUUID`) so
                                the storage key can be namespaced by it without a second
                                round trip. Shares its MIME allowlist/size cap (now including
                                image/video/audio, 25MB) with Assets via
                                `common/constants/file-upload.constants.ts`. POST
                                /documents/batch uploads several files at once; replaceFile
                                snapshots the superseded file into a DocumentVersion first,
                                giving an append-only version history for free
    small-groups/              Home groups, cell groups, Bible studies, and age-graded
                                Sunday School classes — structurally mirrors Ministry &
                                Volunteer Management (flat, role-based rosters) but is a
                                distinct module with scheduling/capacity/age-range fields; a
                                new membership is rejected once capacity is reached, the same
                                soft-cap pattern EventRegistration already uses
    users/                     Tenant-scoped user management
    roles/                     Tenant-defined roles built from the permission catalog
    permissions/                Global, read-only permission catalog
    config-engine/             The generic configuration engine (ministries,
                                contribution types, ceremony names, membership
                                categories, feature toggles — all as data)
  prisma/seed.ts                Seeds the permission catalog, a demo tenant, branch
                                types, membership categories, member activity types,
                                contribution types, service types, attendance methods,
                                ministry types, event types, staff positions, departments,
                                asset categories, asset conditions, visitor sources, visitor
                                group types, visitor activity types, document categories,
                                small group types, example asset:vehicle/asset:building
                                custom fields (including two file-upload fields), two
                                example member custom fields, and a headquarters branch
  test/                         Unit tests (auth, guards, config, queue, storage,
                                tenant scoping, MFA, branches, families, members, member
                                activities, tenant profile, finance, attendance, ministries,
                                notifications, custom fields, events, staff, payroll,
                                reports, report/list exports, assets, visitors, visitor
                                groups, visitor activities, documents, small groups, audit,
                                approval workflows, deadlines, branch scope, hierarchy
                                requirements) + e2e auth flow

frontend/                      Next.js 14 + Tailwind v4 + shadcn/ui
  app/page.tsx                   Public landing page (denominations, live modules, CTAs)
  app/login/page.tsx            Email + password sign-in — no workspace field; a second
                                  step asks which workspace (if ambiguous) or for an
                                  authenticator code (if MFA is enabled)
  app/forgot-password/page.tsx  Request a password reset link (not tenant-scoped)
  app/reset-password/page.tsx   Complete a reset using the emailed token
  app/verify-email/page.tsx     Confirm an email using the emailed token
  app/admin/settings/security/page.tsx  Enroll in / disable TOTP 2FA, an "Active
                                  sessions" list with a per-device "Sign out" action, and
                                  a "Recent login activity" feed
  app/admin/layout.tsx           Shared sidebar shell for every /admin/* page + a
                                  dismissible "verify your email" banner
  app/admin/page.tsx             Dashboard — live counts + jump-off cards into each module
  app/admin/reports/page.tsx     Reports & Analytics dashboard — recharts-based trend charts
                                  over Finance/Attendance/Membership/Payroll, computed live,
                                  plus a CSV/XLSX/PDF download row for each of the four summaries
  app/admin/config/page.tsx      Church Admin UI for the Configuration Engine
  app/admin/branches/page.tsx    Church Admin UI for the organizational hierarchy tree,
                                  plus a "requirements owed upward" panel per selected
                                  branch (open a submission cycle, mark it submitted)
  app/admin/hierarchy-requirements/page.tsx  Church Admin UI to define requirements between
                                  organizational levels and review/approve/reject submissions
                                  across every branch that owes one
  app/admin/members/page.tsx     Church Admin UI for members — renders this tenant's
                                  custom fields dynamically alongside the fixed ones, plus a
                                  "History" panel per member merging ministries/small groups/
                                  events/attendance/giving/activities into one timeline, with
                                  a form to log new tenant-configurable activities, and a
                                  CSV/XLSX/PDF export of the current filtered list
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
  app/admin/visitors/page.tsx     Church Admin UI for visitors — an Individuals/Groups tab
                                  switch over the same master-detail layout, activity type
                                  (not just "follow-up") selection rendering per-type custom
                                  fields dynamically, in-place status changes, a
                                  convert-to-member action for individuals, and a CSV/XLSX/PDF
                                  export of the current filtered Individuals list
  app/admin/documents/page.tsx    Church Admin UI for documents — single or multi-file
                                  upload, category/search filtering, download, in-place file
                                  replacement, an expand-in-place inline preview for images/
                                  video/audio, and a per-document version history list
  app/admin/small-groups/page.tsx Church Admin UI for small groups and Sunday School
                                  classes — schedule/location/capacity/age-range in the
                                  create form, master-detail roster management with a
                                  live "X / capacity" count
  app/admin/notifications/page.tsx Church Admin UI for sending/reviewing notifications
  app/admin/settings/custom-fields/page.tsx  Define custom fields per entity type — asset
                                  categories appear here automatically as `asset:{category}`
                                  entity types, sourced from the asset_category ConfigItems
  app/onboarding/page.tsx        First-run wizard (name your levels -> headquarters -> build structure -> finish)
  components/admin-nav.tsx       The sidebar nav consumed by app/admin/layout.tsx —
                                  now also a workspace switcher when a user has more
                                  than one church
  components/email-verification-banner.tsx  Dismissible nudge shown when the
                                  current user's email isn't verified yet
  components/dynamic-custom-fields.tsx  Renders whatever fields GET
                                  /custom-field-definitions returns, grouped into
                                  sections and filtered by role — the form-side half
                                  of the Custom Fields mechanism, covering all 19
                                  field types
  components/rich-text-editor.tsx  Dependency-free bold/italic/lists/links editor
                                  backing the `richtext` custom field type
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
npm test                     # unit tests (auth/MFA, PBAC guard, config, queue, storage, tenant scoping, branches, families, members, member activities, finance, attendance, ministries, notifications, custom fields, events, staff, payroll, reports, report/list exports, assets, visitors, visitor groups, visitor activities, documents, small groups)
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
    an edit or delete path.** `VisitorActivity` rows are never updated or
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
29. **A proven pattern gets reused when the requirements genuinely match it —
    not avoided just because it looks similar to something that already
    exists, and not copied wholesale when the requirements actually
    differ.** Small Groups & Children's Ministry (Module 13) mirrors
    Ministry & Volunteer Management's shape closely (`SmallGroup`/
    `SmallGroupMembership` next to `Ministry`/`MinistryMembership`: flat,
    optionally branch-scoped, unique name per tenant, role-based membership
    with no denormalized leader field) because a discipleship group and a
    volunteer team really do have the same roster structure. But it's a
    separate module, not an extension of `Ministry`, because the two model
    different concerns — serving vs. fellowship/children's classes — and
    because small groups carry fields (`meetingDay`/`meetingTime`/
    `location`/`capacity`/`minAge`/`maxAge`) a volunteer team has no use
    for. Capacity enforcement itself reuses a third pattern verbatim —
    `EventRegistration`'s soft-cap-checked-at-creation-time check (rule
    from the Events business analysis) — because a small group filling up
    is exactly the same shape as an event filling up. Three separate
    "reuse or don't" calls in one module, each made on its own merits.
30. **A cross-cutting mechanism can grow a new axis without becoming a
    different mechanism.** Custom Fields' `CustomFieldDefinition` gained
    `section` (grouping), `visibleToRoleNames` (role-scoped visibility),
    `validationRules` (generic minLength/maxLength/min/max/pattern), and
    `lookupEntityType`, plus 13 new field types on top of the original 6 —
    but every one of these plugs into the same `getDefinitions`/`setValues`/
    `assertRequiredFieldsProvided` contract every integrating module
    already calls. No integrating module (Members, Assets) needed to
    change for this to ship. The one genuinely new component,
    `RichTextEditor`, is deliberately scoped to what a `richtext` field
    needs (bold/italic/lists/links) and not to embeds/mentions/tables —
    see `docs/custom-fields/business-analysis.md`.
31. **The same escape hatch that makes tenant scoping structural also has
    to allow the handful of places tenant scoping is genuinely wrong.**
    `PrismaService.unscoped` is a second, deliberately un-extended Prisma
    client — routing a login by email across every tenant, and resolving a
    password-reset/email-verification token, are cases where the tenant
    isn't known yet; it's *what's being discovered*. Every other query in
    the codebase still goes through the tenant-scoping extension (rule
    #5/#31 of the original FR-6.4) exactly as before. `unscoped` is named
    and commented as narrowly as possible on purpose: it must never be
    used for tenant-owned business data, only identity-routing rows
    (`User`, `PasswordResetToken`, `EmailVerificationToken`). See
    `docs/business-analysis.md`.
32. **Naming your own hierarchy levels needed zero new schema.** The
    onboarding wizard's new "name your levels" and "build your structure"
    steps are just the Configuration Engine (`branch_type` `ConfigItem`s)
    and the existing `POST /branches` endpoint, driven interactively — the
    same composition the standalone Branches page already used. The one
    behavior change is that `PATCH /tenant/onboarding/complete` is now
    called mid-wizard (right after headquarters creation) instead of only
    at the end, which is safe only because that endpoint was already
    idempotent (design decision #7). See
    `docs/church-hierarchy/business-analysis.md`.
33. **A cross-cutting invariant that Prisma can't express in the schema
    belongs in the service layer, named and tested explicitly.** A
    `VisitorActivity` must target exactly one of an individual `Visitor` or
    a whole `VisitorGroup` — Postgres has no portable single-`CHECK` for
    "exactly one of these two nullable columns is set" that Prisma's schema
    DSL can express, so `VisitorActivitiesService.assertExactlyOneTarget`
    enforces it in code, the same place `assertBranchExists`-style
    cross-record invariants already live throughout this codebase.
    `activityType` composes into Custom Fields exactly the way Assets'
    `assetCategory` does (`visitor_activity:{activityType}`, mirroring
    `asset:{assetCategory}`) — a Baptism Class activity and a Prayer
    activity can require completely different extra fields with zero code
    changes. See `docs/visitor-management/business-analysis.md`.
34. **A per-member report belongs next to the tenant-wide ones, not inside
    the module it reports on.** `GET /reports/members/:id/activity-history`
    lives in `ReportsService`, not `MembersService`, even though it's
    scoped to a single record — it's still a cross-module read (Ministries,
    Small Groups, Events, Attendance, Contributions, and the new
    `MemberActivity`) with no new Prisma models of its own, the exact
    discipline every other report in that module already follows (design
    decision #22). `MemberActivity` itself is the third model to use the
    composed-entityType trick (`member_activity:{activityType}`, after
    `asset:{assetCategory}` and `visitor_activity:{activityType}`) — see
    `docs/member-activities/business-analysis.md`.
35. **An export re-serializes what a summary method already computed — it
    never re-queries.** `ReportsController.exportFinanceSummary` (and its
    three siblings) call the exact same `financeSummary`/`attendanceTrends`/
    `membershipGrowth`/`payrollSummary` methods the dashboard charts use,
    then hand the resulting buckets to `common/exports/export.util.ts`. A
    CSV/XLSX/PDF export can never show different numbers than the chart for
    the same date range, because there's only one query path, not two.
    CSV is written by hand (a dependency isn't worth it for string-joining
    and comma-escaping); XLSX uses `exceljs` and PDF uses `pdfkit`, both
    genuinely saving real effort over hand-rolling either format. The same
    `sendExportFile` helper backs the two flagship list-view exports
    (`GET /members/export`, `GET /visitors/export`), each capped at 5000
    rows since an export is a one-shot download, not a paginated UI. See
    `docs/reports/business-analysis.md`.
36. **Version history is a byproduct of the action that needs it, not a
    parallel bookkeeping step.** `DocumentsService.replaceFile` snapshots the
    file it's about to overwrite into a `DocumentVersion` row in the same
    method that performs the replacement — there's no separate "remember to
    version this" call a future change could forget to make. The same shared
    MIME allowlist that gates Document uploads was extended to cover image/
    video/audio (not just office documents) so those types could reach the
    platform at all and be previewed inline; `POST /documents/batch` is
    many ordinary `POST /documents` calls sharing metadata, not a new kind of
    record. See `docs/document-management/business-analysis.md`.
37. **A field already earmarked but never wired up (`replacedBy`) is finished,
    not left decorative.** `RefreshToken.replacedBy` existed in the schema
    since the Foundation module but nothing ever set it. Rather than leaving
    it dead or removing it, `refresh()` now sets it on rotation and forwards
    the rotating request's device/IP to the new row, turning what was a flat
    table of tokens into an actual chain of *device sessions* — the same
    session, reflected accurately, across every rotation. Failed-login
    auditing is deliberately narrower than "log every attempt": only
    attempts against a resolved `User` row are audited
    (`auth.login_failed` + reason), because an unresolved email has no
    owner who could act on the entry — logging it would be noise wearing
    the shape of a security feature. See `docs/business-analysis.md`.
38. **Three cross-cutting needs (approval chains, deadlines, mandatory-reason audit) get
    one generic implementation each, keyed by `(entityType, entityId)`, rather than a
    bespoke mechanism per consumer.** `ApprovalWorkflow`/`Step`/`Request` power member
    registration, Dynamic Module status transitions, and hierarchy requirement submissions
    from one engine; `Deadline` and `AuditService` are the same story. This mirrors how
    Custom Fields' `entityType` composition already serves Assets/Visitor Activities/
    Member Activities from one mechanism (design decisions #23/#33/#34) — the pattern
    generalizes to non-field concerns just as well as it did to fields. An approval
    decision is recorded through `AuditService` rather than a fourth dedicated table,
    since the audit log is already the source of truth for "who decided what, when, why."
    See `docs/governance/business-analysis.md`.
39. **A requirement between organizational levels is keyed by branch *type*, not by a pair
    of specific branches.** `HierarchyRequirement.{parentBranchType, childBranchType}`
    reuses the same `branchType` string every `Branch` already carries, so "Diocese
    requires a monthly report from District" is one row that automatically applies to
    every District under every Diocese — not one row per branch pair, and not a new
    hierarchy concept alongside the existing self-referencing `Branch` tree. A submission's
    `periodLabel` is stored as a concrete `""` rather than `null` for one-off requirements,
    because Postgres treats every `NULL` as distinct within a unique index — a nullable
    column there would have silently allowed duplicate one-off submissions. See
    `docs/hierarchy-requirements/business-analysis.md`.

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
- **Authentication hardening**: email-first login with multi-workspace
  disambiguation and switching, password reset, email verification, and a
  frontend for the TOTP 2FA endpoints that already existed on the backend.
  See design decision #31 and `docs/business-analysis.md`.
- **Custom Fields form-builder extension**: sections, role-based visibility,
  validation rules, and 13 new field types (richtext, radio, multiselect,
  email, phone, address, time, gps, image, video, audio, signature, lookup),
  backed by a new dependency-free `RichTextEditor` component. See design
  decision #30 and `docs/custom-fields/business-analysis.md`.
- **Onboarding wizard redesign**: the old 3-step (Welcome -> Headquarters ->
  Finish) wizard is now 5 steps, letting a church name its own hierarchy
  levels and build out several branches interactively before finishing,
  instead of only creating a single headquarters branch. See design
  decision #32 and `docs/church-hierarchy/business-analysis.md`.
- **Visitor groups + configurable visitor activities**: a new `VisitorGroup`
  model tracks families/delegations/choir visits/mission teams (individual
  `Visitor`s can optionally belong to one), and the old fixed-shape
  `VisitorFollowUp` is replaced by `VisitorActivity` — a tenant-defined
  `activityType` (First Visit, Counseling, Prayer, Baptism Class, Marriage
  Class, Deliverance, Bible Study, Outreach, Conference, or a custom type)
  with its own Custom Fields per type, loggable against either an
  individual or a whole group. See design decision #33 and
  `docs/visitor-management/business-analysis.md`.
- **Member Activities & Personal History (new Module 14)**: a new
  `MemberActivity` model logs sacraments/trainings/certificates/leadership
  appointments/volunteer work per member (`member_activity:{type}` composed
  Custom Fields), and `GET /reports/members/:id/activity-history` merges it
  with Ministry, Small Group, Event, Attendance, and Contribution data into
  one sorted timeline — surfaced on the Members page as a "History" panel
  per member. See design decision #34 and
  `docs/member-activities/business-analysis.md`.
- **Report exports**: `GET .../export` siblings on all four Reports & Analytics summaries,
  downloadable as CSV/XLSX/PDF (`?format=`), plus the same pattern applied to two flagship
  per-module list views (`GET /members/export`, `GET /visitors/export`). No new query path —
  every export re-serializes what its JSON counterpart already computed. See design decision
  #35 and `docs/reports/business-analysis.md`.
- **File management polish**: `POST /documents/batch` for multi-file upload, the shared MIME
  allowlist extended to image/video/audio (25MB cap, up from 10MB) so Document Management can
  preview them inline, and a `DocumentVersion` model giving an append-only version history
  every time a file is replaced. (Virus scanning remains out of scope — it needs a 3rd-party
  service this environment has no credentials for.) See design decision #36 and
  `docs/document-management/business-analysis.md`.
- **Session/device management + login history**: every issued `RefreshToken` now records the
  request's `User-Agent`/IP and carries that identity forward across rotation
  (`replacedBy`, previously an unused column). `GET /auth/sessions` +
  `DELETE /auth/sessions/:id` give self-service "see and sign out my other devices";
  `GET /auth/login-history` surfaces the last 50 login/failed-login/logout/switch-tenant
  events for the calling user, reusing `AuditLog` rather than a new table. See design
  decision #37 and `docs/business-analysis.md`.
- **Governance foundation (new Module 15)**: `AuditService`, `ApprovalWorkflow`/`Step`/
  `Request`, `Deadline`, and `BranchScopeService` — the shared infrastructure a larger,
  in-progress pass (configurable requirements between organizational levels, a Dynamic
  Module Builder, organizational visibility roll-up, member registration approval) builds
  on, rather than three or four bespoke mechanisms invented per feature. See design
  decision #38 and `docs/governance/business-analysis.md`.
- **Configurable requirements between organizational levels (new Module 16)**: a Church
  Administrator (or any parent-level officer) can now define what one branch type requires
  of the branch type directly beneath it — reports, documents, forms, activities, or
  compliance items — on a stated cadence, optionally gated by one of Module 15's approval
  chains, and optionally notifying named roles by email the moment a new cycle opens. Child
  branches see what they owe on the Branches page itself (a "requirements owed upward"
  panel per selected branch) and open/submit cycles from there; a new
  `/admin/hierarchy-requirements` page lets the parent level review and decide every
  submission across every branch that owes one. See design decision #39 and
  `docs/hierarchy-requirements/business-analysis.md`.

## Next module

Modules 0-14 (Foundation through Member Activities & Personal History) plus the
cross-cutting Custom Fields mechanism are complete, and every item on this pass's working
list (Tasks 1-12: form-builder Custom Fields, password reset, email verification, MFA UI,
multi-workspace login, dynamic hierarchy onboarding, visitor groups/activities, member
activities + personal history, report/list exports, file management polish, and
session/login-history) is now done.

What's left is everything each module's own "Out of Scope" section already names
explicitly and for a stated reason — not a hidden gap, but a deliberate line drawn under
time/dependency constraints this environment has (no credentials for virus scanning, IP
geolocation, or a real email/SMS gateway; no admin-facing "see other users' sessions" view;
no configurable report builder; no full rich-text mentions/tables/embeds; no barcode/QR
generation or GPS map picker widget for Custom Fields' `gps`/`barcode`-flavored fields
beyond their current plain-value storage). Any of these is a reasonable next module to pick
up — each one's business-analysis doc explains the specific reason it was deferred and what
building it for real would require.

Whichever is picked up should still follow the established patterns: tenant
scoping structural not optional, `ConfigItem` for tenant-specific "types,"
permission-guarded controllers, soft delete or the stricter void/status
pattern where money or an audit trail is involved, Custom Fields'
`entityType` composition trick where a feature needs per-category fields,
dedicated conversion/action endpoints for anything with real side effects
rather than a plain field edit, and the shared constants/helpers pattern
(file-upload limits, the multipart request helper) for any cross-cutting
technical concern two features both need.
