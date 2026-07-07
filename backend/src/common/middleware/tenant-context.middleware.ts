import { Injectable, NestMiddleware, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { tenantContextStorage } from '../tenant-context.storage';

/**
 * Resolves the current tenant for every incoming request, in order of
 * precedence: custom domain -> X-Tenant-Slug header -> subdomain.
 *
 * Public, non-tenant-scoped routes (e.g. platform admin login, health
 * checks) should be excluded via `MiddlewareConsumer#exclude` in AppModule.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const host = req.hostname;
    const headerSlug = req.header('x-tenant-slug');

    let tenant = null;

    if (host) {
      tenant = await this.prisma.tenant.findFirst({
        where: { customDomain: host, deletedAt: null },
      });
    }

    if (!tenant && headerSlug) {
      tenant = await this.prisma.tenant.findFirst({
        where: { slug: headerSlug, deletedAt: null },
      });
    }

    if (!tenant && host) {
      const subdomain = host.split('.')[0];
      tenant = await this.prisma.tenant.findFirst({
        where: { slug: subdomain, deletedAt: null },
      });
    }

    if (!tenant) {
      throw new BadRequestException({
        code: 'TENANT_NOT_RESOLVED',
        message: 'Could not resolve a church (tenant) for this request.',
      });
    }

    if (!tenant.isActive) {
      throw new ForbiddenException({
        code: 'TENANT_INACTIVE',
        message: 'This church account is inactive. Contact support.',
      });
    }

    req.tenant = { tenantId: tenant.id, slug: tenant.slug };
    // Runs the rest of the request (guards -> controller -> service ->
    // Prisma) inside an AsyncLocalStorage context so the tenant-scoping
    // Prisma extension can read tenantId without it being threaded through
    // every call.
    tenantContextStorage.run({ tenantId: tenant.id }, () => next());
  }
}
