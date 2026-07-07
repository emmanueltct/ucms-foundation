import { tenantScopingAllOperations } from '../src/prisma/tenant-scoping.extension';
import { tenantContextStorage } from '../src/common/tenant-context.storage';

describe('tenantScopingAllOperations', () => {
  const runWithTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
    tenantContextStorage.run({ tenantId }, fn);

  it('passes through untouched for models without a tenantId column', async () => {
    const query = jest.fn().mockResolvedValue('ok');

    const result = await tenantScopingAllOperations({
      model: 'Tenant',
      operation: 'findMany',
      args: {},
      query,
    });

    expect(result).toBe('ok');
    expect(query).toHaveBeenCalledWith({});
  });

  it('auto-injects tenantId into a where clause missing it, using the active tenant context', async () => {
    const query = jest.fn().mockResolvedValue('ok');

    await runWithTenant('tenant-1', () =>
      tenantScopingAllOperations({
        model: 'User',
        operation: 'findFirst',
        args: { where: { id: 'user-1' } },
        query,
      }),
    );

    expect(query).toHaveBeenCalledWith({ where: { id: 'user-1', tenantId: 'tenant-1' } });
  });

  it('leaves an explicit tenantId in the where clause untouched', async () => {
    const query = jest.fn().mockResolvedValue('ok');

    await runWithTenant('tenant-1', () =>
      tenantScopingAllOperations({
        model: 'User',
        operation: 'findFirst',
        args: { where: { id: 'user-1', tenantId: 'tenant-2' } },
        query,
      }),
    );

    // caller's explicit tenantId wins, even if it differs from the ambient context
    expect(query).toHaveBeenCalledWith({ where: { id: 'user-1', tenantId: 'tenant-2' } });
  });

  it('throws instead of running an unscoped query with no active tenant context', async () => {
    const query = jest.fn().mockResolvedValue('ok');

    await expect(
      tenantScopingAllOperations({
        model: 'User',
        operation: 'findMany',
        args: { where: {} },
        query,
      }),
    ).rejects.toThrow(/Tenant scoping violation/);

    expect(query).not.toHaveBeenCalled();
  });

  it('auto-injects tenantId into data on create', async () => {
    const query = jest.fn().mockResolvedValue('ok');

    await runWithTenant('tenant-1', () =>
      tenantScopingAllOperations({
        model: 'ConfigItem',
        operation: 'create',
        args: { data: { key: 'tithe' } },
        query,
      }),
    );

    expect(query).toHaveBeenCalledWith({ data: { key: 'tithe', tenantId: 'tenant-1' } });
  });

  it('auto-injects tenantId into every row on createMany', async () => {
    const query = jest.fn().mockResolvedValue('ok');

    await runWithTenant('tenant-1', () =>
      tenantScopingAllOperations({
        model: 'AuditLog',
        operation: 'createMany',
        args: { data: [{ action: 'a' }, { action: 'b', tenantId: 'tenant-2' }] },
        query,
      }),
    );

    expect(query).toHaveBeenCalledWith({
      data: [
        { action: 'a', tenantId: 'tenant-1' },
        { action: 'b', tenantId: 'tenant-2' },
      ],
    });
  });
});
