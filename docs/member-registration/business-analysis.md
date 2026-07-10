# Module 19: Member Registration — admin + self, with configurable approval

## 1. Business Description

Requirement #5: a person should be able to become a member either through an
administrator directly creating their profile (already supported since Module 2) or by
registering themselves — choosing which Church/Branch/Parish/Cell/Work Group they're
joining — with the resulting profile held as `pending` until an administrator reviews it.
This module adds the self-service path and the approve/reject decision, reusing
`Member.membershipStatus` (already a plain string column, no enum migration needed) and
Module 15's `ApprovalWorkflow` engine for tenants that want a configured chain of
approvers rather than a single direct decision.

## 2. Actors

Same actor set as the Foundation module ([../business-analysis.md](../business-analysis.md)).

| Actor | Relevance |
|---|---|
| A prospective member (no account, no session) | Submits the public registration form |
| Whoever holds `member.registration.decide` | Approves or rejects a pending registration, with a mandatory reason |
| Approver (per an optional `member_registration` `ApprovalWorkflow`) | Decides a specific step in a configured chain, if one exists |

## 3. Key Business Rules

- **Self-registration always creates `membershipStatus: "pending"` — never
  configurable by the submitter.** `RegisterMemberDto` has no `membershipStatus` field at
  all (unlike `CreateMemberDto`, which lets an admin set it directly); the service hard-
  codes `'pending'` regardless of what's submitted.
- **The public endpoint is unauthenticated via the same `@Public()` mechanism
  `POST /auth/register` already uses** — not a separate `/public/:tenantSlug/...` path.
  `TenantContextMiddleware` still resolves the tenant from the `X-Tenant-Slug` header (or
  subdomain) exactly as it does for every other tenant-scoped route; `@Public()` only
  tells `JwtAuthGuard` to skip the JWT check. `PermissionsGuard`/`RolesGuard` pass through
  automatically since the route declares no `@Permissions()`/`@Roles()` requirement.
- **A dedicated, minimal public branches endpoint backs the registration picker.**
  `GET /members/register/branches` returns only `{id, name, branchType, parentBranchId}` —
  no address, code, or other admin-facing fields — rather than exposing the full,
  authenticated `GET /branches` endpoint publicly. It's rate-limited the same as the
  registration submission itself is (5/min), consistent with how every other unauthenticated
  endpoint in this platform (`auth/register`, `auth/login`) is throttled.
- **Approval reuses Module 15's engine only when a tenant has actually configured
  one.** `approve`/`reject` look up an active `ApprovalWorkflow` for entityType
  `"member_registration"`; if found, the decision is routed through
  `ApprovalWorkflowsService` (enforcing the current step's gating role/permission); if not,
  the decision is recorded directly via `AuditService`. Either path sets the member's
  `membershipStatus` immediately — the same simplification `HierarchyRequirementsService.decide`
  and `DynamicModuleRecordsService.changeStatus` already make, rather than waiting for
  every step of a multi-step chain to complete before the visible status changes.
- **Only a `pending` member can be approved or rejected** — rejected with
  `400 MEMBER_NOT_PENDING` otherwise, preventing a decision being replayed against a
  member whose status has already moved on.
- **Admin-created members are unaffected.** `CreateMemberDto.membershipStatus` still
  defaults to `"active"` exactly as before; `pending`/`rejected` are simply two more values
  an admin can also set directly if they want to log an admin-side registration as
  pending for review, but nothing forces that path.

## 4. Out of Scope for This Module

- **Email/SMS notification to the registrant when their registration is decided** — the
  registrant has no account and no verified contact channel guaranteed at submission time
  (both `email` and `phone` are optional on `RegisterMemberDto`); wiring this to the
  existing Communication module is a reasonable future addition once a channel is
  reliably present, not built speculatively now.
- **CAPTCHA or other bot-mitigation beyond rate limiting** — the same 5/min throttle
  `auth/register`/`auth/login` already use is judged sufficient for this pass; a
  CAPTCHA integration would need a third-party service this environment has no
  credentials for, consistent with several other documented "no 3rd-party credentials"
  scope lines elsewhere in this project.
- **A public status-check page** ("is my registration approved yet?") — the registrant
  has no account to check it with; this is a reasonable future addition once
  self-registration optionally captures a way to look the registration back up.
