import { Test } from '@nestjs/testing';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    auditLog: { create: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  it('writes action/entityType/entityId with no metadata when no optional context is given', async () => {
    await service.record(TENANT_ID, 'user-1', 'member.deleted', 'member', 'member-1');

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_ID,
        userId: 'user-1',
        action: 'member.deleted',
        entityType: 'member',
        entityId: 'member-1',
        reason: undefined,
        previousValue: undefined,
        newValue: undefined,
        ipAddress: undefined,
        metadata: undefined,
      },
    });
  });

  it('persists reason, previousValue, and newValue as first-class fields', async () => {
    await service.record(TENANT_ID, 'user-1', 'member.status_changed', 'member', 'member-1', {
      reason: 'Requested by the member in writing.',
      previousValue: { membershipStatus: 'active' },
      newValue: { membershipStatus: 'inactive' },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'Requested by the member in writing.',
          previousValue: { membershipStatus: 'active' },
          newValue: { membershipStatus: 'inactive' },
        }),
      }),
    );
  });

  it('folds userAgent into metadata alongside any extra metadata', async () => {
    await service.record(TENANT_ID, 'user-1', 'auth.login', 'User', 'user-1', {
      userAgent: 'Mozilla/5.0',
      ipAddress: '1.2.3.4',
      metadata: { reason: 'invalid_password' },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ipAddress: '1.2.3.4',
          metadata: { userAgent: 'Mozilla/5.0', reason: 'invalid_password' },
        }),
      }),
    );
  });
});
