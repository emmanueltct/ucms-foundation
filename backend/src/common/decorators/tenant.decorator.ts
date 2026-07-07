import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Usage: findAll(@CurrentTenantId() tenantId: string)
 * Pulls the tenant id resolved by TenantContextMiddleware for this request.
 */
export const CurrentTenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return request.tenant?.tenantId;
});
