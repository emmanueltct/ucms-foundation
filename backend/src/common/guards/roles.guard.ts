import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;
    if (user.isPlatformAdmin) return true;

    const hasRole = requiredRoles.some((r) => user.roles?.includes(r));
    if (!hasRole) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: `Requires one of roles: ${requiredRoles.join(', ')}`,
      });
    }
    return true;
  }
}
