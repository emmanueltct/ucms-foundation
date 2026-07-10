import { SetMetadata } from '@nestjs/common';

export const REQUIRES_AUDIT_REASON_KEY = 'ucms:requiresAuditReason';

/**
 * Marks a route as one of the "important record" actions that must carry a
 * user-supplied reason (removing a member, approving/rejecting a request,
 * extending a deadline, ...) — enforced by `RequiresAuditReasonGuard`, the
 * same metadata + guard shape `@Permissions()`/`PermissionsGuard` already
 * use. The handler's own DTO should still extend `RequireReasonDto` for
 * class-validator's field-level error message; this decorator is the
 * belt-and-suspenders check that survives even if a DTO is ever misshapen.
 */
export const RequiresAuditReason = () => SetMetadata(REQUIRES_AUDIT_REASON_KEY, true);
