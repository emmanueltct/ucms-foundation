import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/request-context.interface';

/**
 * Usage: me(@CurrentUser() user: AuthenticatedUser)
 * Populated by JwtStrategy after the access token is validated.
 */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
