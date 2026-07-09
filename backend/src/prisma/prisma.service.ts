import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantScopingExtension } from './tenant-scoping.extension';

/**
 * Thin wrapper around PrismaClient so it can be injected like any other
 * provider, and so connection lifecycle hooks into Nest's module lifecycle.
 *
 * `$extends()` returns a new client instance rather than mutating `this`,
 * so the extended methods are copied back onto `this` via Object.assign —
 * the standard pattern for applying Client Extensions to a PrismaClient
 * subclass that must remain a single injectable instance.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * A second, deliberately UNEXTENDED client — reserved for the handful of
   * legitimate cross-tenant identity lookups (routing a login by email to
   * the right tenant, resolving a global password-reset token) where the
   * tenant is exactly what's being discovered, so the tenant-scoping
   * extension's "no tenant context" guard would otherwise throw. Never use
   * this for tenant-owned business data — every call site using it must
   * only ever touch identity-routing rows (User email/tenant lookups,
   * PasswordResetToken), and only to decide *which* tenant to operate in,
   * never to read or write that tenant's actual records.
   */
  readonly unscoped = new PrismaClient();

  async onModuleInit() {
    await this.$connect();
    await this.unscoped.$connect();
    Object.assign(this, this.$extends(tenantScopingExtension));
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.unscoped.$disconnect();
  }
}
