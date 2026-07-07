import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'ucms:roles';

/**
 * Coarse-grained convenience guard. Prefer @Permissions for real
 * authorization decisions — role names are configurable per tenant, so
 * checking permission codes is the durable contract.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
