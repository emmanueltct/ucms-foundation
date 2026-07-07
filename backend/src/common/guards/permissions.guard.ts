import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;
    if (user.isPlatformAdmin) return true;

    const hasPermission = requiredPermissions.some((p) => user.permissions?.includes(p));
    if (!hasPermission) {
      throw new ForbiddenException({
        code: 'PERMISSION_FORBIDDEN',
        message: `Requires one of permissions: ${requiredPermissions.join(', ')}`,
      });
    }
    return true;
  }
}
