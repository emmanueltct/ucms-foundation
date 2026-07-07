import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'ucms:permissions';

/**
 * Fine-grained authorization. Route is allowed if the current user has
 * ANY of the listed permission codes (OR semantics). Compose multiple
 * @Permissions-guarded checks in the service layer for AND semantics.
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
