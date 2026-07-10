# Functional Requirements — Organizational Visibility Roll-up

## FR-OV-1 Visibility Resolution

- FR-OV-1.1 Every touched controller resolves the calling user's visible branch set once,
  via `BranchScopeService.resolveVisibleBranchIds(tenantId, user.userId)` (Module 15,
  Phase 0), before calling into its service's list/export/summary method.
- FR-OV-1.2 `resolveVisibleBranchIds` returns `null` (unrestricted) when
  `User.assignedBranchId` is unset — the default for every user on every tenant — or
  `[assignedBranchId, ...descendants]` (reusing `BranchesService.findDescendants`) when
  set.

## FR-OV-2 Applying the Filter

- FR-OV-2.1 `resolveBranchFilter(requestedBranchId, visibleBranchIds)` — for entities that
  always belong to exactly one branch (`Member`, `Visitor`, `Contribution`,
  `AttendanceRecord`) — merges a caller's explicit `?branchId=` with their visible set:
  unrestricted callers pass through unchanged; a restricted caller with no explicit
  request is scoped to `branchId IN (visibleBranchIds)`; a restricted caller requesting a
  branch outside their visible set resolves to an impossible filter (zero results, not an
  error).
- FR-OV-2.2 `resolveBranchFilterIncludingChurchWide(requestedBranchId, visibleBranchIds)`
  — for entities that may themselves be church-wide (`Ministry`, `Event`, `Document`, all
  nullable `branchId`) — applies the same merge, but a restricted caller with no explicit
  request also matches `branchId IS NULL` records (composed under `AND: [{ OR: [...] }]`
  so it can be spread alongside a caller's own `OR` clause, e.g. Documents' title/
  description search, without either overwriting the other).
- FR-OV-2.3 Both functions are pure (no DI), living in
  `backend/src/common/branch-scope/branch-visibility.util.ts`, and are called directly
  from each service's existing `buildWhere` private method.

## FR-OV-3 Endpoints Affected

Applied to the list, export, and summary endpoints of:

| Module | Endpoints | Church-wide-eligible? |
|---|---|---|
| Members | `GET /members`, `GET /members/export` | No |
| Visitors | `GET /visitors`, `GET /visitors/export` | No |
| Finance | `GET /contributions`, `GET /contributions/summary` | No |
| Attendance | `GET /attendance-records`, `GET /attendance-records/summary` | No |
| Ministries | `GET /ministries` | Yes |
| Events | `GET /events` | Yes |
| Documents | `GET /documents` | Yes |

`GET /members/:id`, `GET /visitors/:id`, etc. (single-record reads) are unaffected — this
pass only scopes list-shaped endpoints, matching the requirement's own framing ("higher
institutions see everything beneath them" is inherently a listing/reporting concern, not a
by-id lookup one).

## FR-OV-4 Non-Functional

- FR-OV-4.1 Every touched service's `findAll`/`findAllForExport`/`summary` method gains an
  additional `visibleBranchIds: string[] | null = null` parameter, defaulted so every
  pre-existing call site (including every existing test) continues to compile and behave
  identically without modification.
- FR-OV-4.2 Every touched module imports `BranchScopeModule` (already existed from Module
  15/Phase 0) so its controller can inject `BranchScopeService`.
- FR-OV-4.3 No new database columns, permission codes, or endpoints are introduced by this
  pass — it is purely a `WHERE`-clause behavior change layered onto existing, already-
  permissioned endpoints.
