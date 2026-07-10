import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequiresAuditReasonGuard } from '../src/common/guards/requires-audit-reason.guard';

function buildContext(body: any, requiresReason: boolean | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiresReason) } as unknown as Reflector;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  } as unknown as ExecutionContext;
  return { reflector, context };
}

describe('RequiresAuditReasonGuard', () => {
  it('allows the request through when the route is not marked @RequiresAuditReason()', () => {
    const { reflector, context } = buildContext({}, undefined);
    const guard = new RequiresAuditReasonGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a missing reason', () => {
    const { reflector, context } = buildContext({}, true);
    const guard = new RequiresAuditReasonGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('rejects a reason under 3 characters after trimming', () => {
    const { reflector, context } = buildContext({ reason: '  ok ' }, true);
    const guard = new RequiresAuditReasonGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('rejects a non-string reason', () => {
    const { reflector, context } = buildContext({ reason: 12345 }, true);
    const guard = new RequiresAuditReasonGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('allows a valid reason through', () => {
    const { reflector, context } = buildContext({ reason: 'Member requested removal in writing.' }, true);
    const guard = new RequiresAuditReasonGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });
});
