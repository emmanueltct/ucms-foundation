/**
 * Merges a caller's explicit `?branchId=` filter with what
 * `BranchScopeService.resolveVisibleBranchIds` says they're actually allowed
 * to see. Pure functions (no DI) so every list endpoint's `buildWhere` can
 * call them directly and they're trivially unit-testable in isolation.
 *
 * - `visibleBranchIds === null` means unrestricted (church-wide/platform
 *   role, or a tenant that never assigned `User.assignedBranchId` — the
 *   default) — behaves exactly as before this mechanism existed.
 * - A requested branch outside the visible set resolves to an impossible
 *   filter (`branchId: NEVER_MATCHING_ID`) rather than silently widening or
 *   narrowing to something the caller didn't ask for — an unauthorized
 *   branch scope reads as "no results," not an error, matching how a
 *   `WHERE` clause naturally behaves elsewhere in this codebase.
 *
 * Two variants, not one function with an option, because their return
 * shapes genuinely differ: a model whose `branchId` column is `NOT NULL`
 * (Member, Contribution, AttendanceRecord) has no `null` in its Prisma
 * `WhereInput` type for that field, so a shared "maybe includes null"
 * return type would force an unsound cast at every non-nullable call site.
 */
const NEVER_MATCHING_ID = '00000000-0000-0000-0000-000000000000';

/** For entities that always belong to exactly one branch (Member, Contribution, AttendanceRecord, Visitor). */
export function resolveBranchFilter(
  requestedBranchId: string | undefined,
  visibleBranchIds: string[] | null,
): { branchId?: string | { in: string[] } } {
  if (visibleBranchIds === null) {
    return requestedBranchId ? { branchId: requestedBranchId } : {};
  }
  if (requestedBranchId) {
    return { branchId: visibleBranchIds.includes(requestedBranchId) ? requestedBranchId : NEVER_MATCHING_ID };
  }
  return { branchId: { in: visibleBranchIds } };
}

/**
 * For entities that may themselves be church-wide (`branchId: null` —
 * Ministry, Event, Document): a branch-scoped caller should still see those,
 * since "roll-up visibility" is meant to add what a scoped user can see,
 * never take away access to something already church-wide.
 *
 * Returns its condition under `AND: [...]` (a single-element array) rather
 * than a bare `OR` key, so a caller that already builds its own `OR` clause
 * (e.g. a text search across multiple columns) can spread both into the same
 * `where` object without one silently overwriting the other — `AND` composes
 * safely because Prisma reads it as "all of these must hold," and a second,
 * separately-spread `AND` array would need the same treatment, whereas a
 * bare `OR` key is a single slot that the last spread simply replaces.
 */
export function resolveBranchFilterIncludingChurchWide(
  requestedBranchId: string | undefined,
  visibleBranchIds: string[] | null,
): { branchId?: string | { in: string[] }; AND?: [{ OR: [{ branchId: { in: string[] } }, { branchId: null }] }] } {
  if (visibleBranchIds === null) {
    return requestedBranchId ? { branchId: requestedBranchId } : {};
  }
  if (requestedBranchId) {
    return { branchId: visibleBranchIds.includes(requestedBranchId) ? requestedBranchId : NEVER_MATCHING_ID };
  }
  return { AND: [{ OR: [{ branchId: { in: visibleBranchIds } }, { branchId: null }] }] };
}
