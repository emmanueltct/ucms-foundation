import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';
import { TRASH_REGISTRY, TrashRegistryEntry } from './trash-registry';

/**
 * One generic service backing the Configuration Center's Trash tab, instead
 * of a bespoke `findDeleted`/`restore` pair on all 19 bounded models' own
 * services — every entry's shape is identical (`deletedAt`-based
 * soft-delete, restore = clear `deletedAt` + `isActive: true`), so this
 * mirrors the same "one generic mechanism over N near-identical models"
 * reasoning already used for `ResourceAssignment`.
 */
@Injectable()
export class TrashService {
  constructor(private readonly prisma: PrismaService) {}

  /** Only the resources the caller actually has permission to see — drives which Trash tabs render. */
  listResources(user: AuthenticatedUser) {
    return TRASH_REGISTRY.filter((entry) => user.isPlatformAdmin || user.permissions.includes(entry.permissionCode)).map((entry) => ({
      key: entry.key,
      label: entry.label,
    }));
  }

  async list(tenantId: string, key: string, user: AuthenticatedUser) {
    const entry = this.resolveEntry(key);
    this.assertPermission(user, entry);
    const delegate = this.delegateFor(entry);
    return delegate.findMany({
      where: { tenantId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: 200,
      ...(entry.select ? { select: entry.select } : {}),
    });
  }

  async restore(tenantId: string, key: string, id: string, user: AuthenticatedUser) {
    const entry = this.resolveEntry(key);
    this.assertPermission(user, entry);
    const delegate = this.delegateFor(entry);

    const existing = await delegate.findFirst({ where: { id, tenantId, deletedAt: { not: null } } });
    if (!existing) {
      throw new NotFoundException({ code: 'TRASH_ITEM_NOT_FOUND', message: 'Deleted item not found.' });
    }

    return delegate.update({
      where: { id, tenantId },
      data: { deletedAt: null, ...(entry.hasIsActive ? { isActive: true } : {}) },
      ...(entry.select ? { select: entry.select } : {}),
    });
  }

  private resolveEntry(key: string): TrashRegistryEntry {
    const entry = TRASH_REGISTRY.find((e) => e.key === key);
    if (!entry) {
      throw new NotFoundException({ code: 'TRASH_RESOURCE_UNKNOWN', message: `Unknown trash resource: ${key}` });
    }
    return entry;
  }

  private assertPermission(user: AuthenticatedUser, entry: TrashRegistryEntry): void {
    if (user.isPlatformAdmin) return;
    if (!user.permissions.includes(entry.permissionCode)) {
      throw new ForbiddenException({ code: 'PERMISSION_FORBIDDEN', message: `Requires permission: ${entry.permissionCode}` });
    }
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private delegateFor(entry: TrashRegistryEntry): any {
    return (this.prisma as any)[entry.delegate];
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
