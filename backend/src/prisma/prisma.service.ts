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
  async onModuleInit() {
    await this.$connect();
    Object.assign(this, this.$extends(tenantScopingExtension));
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
