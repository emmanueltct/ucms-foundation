import { Prisma } from '@prisma/client';
import { getCurrentTenantId } from '../common/tenant-context.storage';

/**
 * Models that carry a `tenantId` column (see schema.prisma). `Tenant` itself,
 * the global `Permission` catalog, and pure join tables (`UserRole`,
 * `RolePermission`) are intentionally excluded — they either *are* the
 * tenant or are scoped transitively through a tenant-owned parent.
 */
const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Role',
  'RefreshToken',
  'ConfigItem',
  'FeatureToggle',
  'AuditLog',
  'Branch',
  'Member',
  'Family',
  'Contribution',
  'AttendanceRecord',
  'Ministry',
  'MinistryMembership',
]);

const WHERE_SCOPED_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

interface AllOperationsArgs {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

/**
 * Closes the gap flagged in FR-6.4 of functional-requirements.md: every
 * query against a tenant-owned model must be scoped by tenantId, today
 * "enforced by code review checklist". This auto-injects the active
 * request's tenantId (read via AsyncLocalStorage, set by
 * TenantContextMiddleware) into `where`/`data` when a caller omits it, and
 * throws when neither an explicit tenantId nor an active tenant context
 * exists — turning a missing filter into a loud failure instead of a silent
 * cross-tenant read.
 *
 * Prisma's "extended where unique inputs" (stable since 4.16) allow adding
 * non-unique fields like `tenantId` alongside `id` in findUnique/update/
 * delete/upsert `where` clauses, so this works even for by-id lookups.
 *
 * Exported standalone (rather than only inline in `Prisma.defineExtension`)
 * so it can be unit-tested directly with fake `{ model, operation, args,
 * query }` inputs, without needing a real Prisma client.
 */
export async function tenantScopingAllOperations({ model, operation, args, query }: AllOperationsArgs) {
  if (!model || !TENANT_SCOPED_MODELS.has(model)) {
    return query(args);
  }

  const tenantId = getCurrentTenantId();

  if (WHERE_SCOPED_OPERATIONS.has(operation)) {
    const scopedArgs = args as { where?: Record<string, unknown> };
    const where = scopedArgs.where ?? {};
    if (where.tenantId === undefined) {
      if (!tenantId) {
        throw new Error(
          `Tenant scoping violation: ${model}.${operation} has no tenantId in "where" and no tenant context is active.`,
        );
      }
      scopedArgs.where = { ...where, tenantId };
    }
  }

  if (operation === 'create') {
    const createArgs = args as { data?: Record<string, unknown> };
    if (createArgs.data && createArgs.data.tenantId === undefined) {
      if (!tenantId) {
        throw new Error(
          `Tenant scoping violation: ${model}.create has no tenantId in "data" and no tenant context is active.`,
        );
      }
      createArgs.data = { ...createArgs.data, tenantId };
    }
  }

  if (operation === 'createMany') {
    const createManyArgs = args as { data?: Record<string, unknown>[] };
    if (Array.isArray(createManyArgs.data)) {
      if (!tenantId && createManyArgs.data.some((row) => row.tenantId === undefined)) {
        throw new Error(
          `Tenant scoping violation: ${model}.createMany has rows missing tenantId and no tenant context is active.`,
        );
      }
      createManyArgs.data = createManyArgs.data.map((row) => (row.tenantId === undefined ? { ...row, tenantId } : row));
    }
  }

  return query(args);
}

export const tenantScopingExtension = Prisma.defineExtension({
  name: 'tenant-scoping',
  query: {
    $allModels: {
      $allOperations: tenantScopingAllOperations,
    },
  },
});
