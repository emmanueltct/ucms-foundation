export interface TenantContext {
  tenantId: string;
  slug: string;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  isPlatformAdmin: boolean;
  permissions: string[];
  roles: string[];
}

/**
 * Augments Express's Request type so `req.tenant` / `req.user` are typed
 * everywhere without `any`.
 */
declare module 'express' {
  interface Request {
    tenant?: TenantContext;
    user?: AuthenticatedUser;
  }
}
