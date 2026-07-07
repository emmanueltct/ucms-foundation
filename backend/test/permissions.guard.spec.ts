import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';

function buildContext(user: any, requiredPermissions: string[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredPermissions) } as unknown as Reflector;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { reflector, context };
}

describe('PermissionsGuard', () => {
  it('allows the request through when the route declares no required permissions', () => {
    const { reflector, context } = buildContext({ permissions: [] }, undefined);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies an unauthenticated request when permissions are required', () => {
    const { reflector, context } = buildContext(undefined, ['finance.contribution.create']);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('always allows platform admins, regardless of their permission list', () => {
    const { reflector, context } = buildContext(
      { isPlatformAdmin: true, permissions: [] },
      ['finance.contribution.create'],
    );
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a user who has one of the required permissions', () => {
    const { reflector, context } = buildContext(
      { isPlatformAdmin: false, permissions: ['finance.contribution.create', 'user.read'] },
      ['finance.contribution.create'],
    );
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException for a user missing every required permission', () => {
    const { reflector, context } = buildContext(
      { isPlatformAdmin: false, permissions: ['user.read'] },
      ['finance.contribution.create'],
    );
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
