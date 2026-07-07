import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextStore {
  tenantId: string;
}

/**
 * Carries the current request's tenantId across the async call chain
 * (guards -> controller -> service -> Prisma) without threading it through
 * every function signature. Populated once per request by
 * TenantContextMiddleware; read by the tenant-scoping Prisma extension so
 * a query can be scoped even if a service forgets to pass tenantId
 * explicitly.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContextStore>();

export function getCurrentTenantId(): string | undefined {
  return tenantContextStorage.getStore()?.tenantId;
}
