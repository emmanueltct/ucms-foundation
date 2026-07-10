import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_AUDIT_REASON_KEY } from '../decorators/requires-audit-reason.decorator';

@Injectable()
export class RequiresAuditReasonGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresReason = this.reflector.getAllAndOverride<boolean>(REQUIRES_AUDIT_REASON_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiresReason) return true;

    const { body } = context.switchToHttp().getRequest();
    const reason = body?.reason;
    if (typeof reason !== 'string' || reason.trim().length < 3) {
      throw new BadRequestException({
        code: 'AUDIT_REASON_REQUIRED',
        message: 'A reason (at least 3 characters) is required for this action.',
      });
    }
    return true;
  }
}
