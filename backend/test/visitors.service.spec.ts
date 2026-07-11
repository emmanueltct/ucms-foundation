import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VisitorsService } from '../src/visitors/visitors.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { ConfigService } from '../src/config-engine/config.service';

describe('VisitorsService', () => {
  let service: VisitorsService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    visitor: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
    branch: { findFirst: jest.fn(), findMany: jest.fn() },
    member: { findFirst: jest.fn() },
    visitorGroup: { findFirst: jest.fn() },
  };

  const mockAudit = { record: jest.fn() };
  const mockConfig = { isFeatureEnabled: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        VisitorsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = moduleRef.get(VisitorsService);
  });

  describe('create', () => {
    const baseDto = { firstName: 'Alice', lastName: 'Uwase', visitDate: '2026-07-05' };

    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.create(TENANT_ID, { ...baseDto, branchId: 'branch-1' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects when invitedByMemberId does not resolve within the tenant', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, { ...baseDto, invitedByMemberId: 'member-1' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates the visitor when references are valid', async () => {
      mockPrisma.visitor.create.mockResolvedValue({ id: 'visitor-1' });

      await service.create(TENANT_ID, baseDto as any);

      expect(mockPrisma.visitor.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_ID, firstName: 'Alice' }) }),
      );
    });

    it('rejects when visitorGroupId does not resolve within the tenant', async () => {
      mockPrisma.visitorGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, { ...baseDto, visitorGroupId: 'group-1' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('links the visitor to a valid visitorGroupId', async () => {
      mockPrisma.visitorGroup.findFirst.mockResolvedValue({ id: 'group-1' });
      mockPrisma.visitor.create.mockResolvedValue({ id: 'visitor-1' });

      await service.create(TENANT_ID, { ...baseDto, visitorGroupId: 'group-1' } as any);

      expect(mockPrisma.visitor.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ visitorGroupId: 'group-1' }) }),
      );
    });
  });

  describe('registerPublic', () => {
    const registerDto = { branchId: 'branch-1', firstName: 'Alice', lastName: 'Uwase', visitDate: '2026-07-05' };

    it('rejects when the guest_access.visitor_registration feature toggle is off', async () => {
      mockConfig.isFeatureEnabled.mockResolvedValue(false);

      await expect(service.registerPublic(TENANT_ID, registerDto as any)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.visitor.create).not.toHaveBeenCalled();
    });

    it('rejects when the branch does not resolve within the tenant, even with the toggle on', async () => {
      mockConfig.isFeatureEnabled.mockResolvedValue(true);
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.registerPublic(TENANT_ID, registerDto as any)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.visitor.create).not.toHaveBeenCalled();
    });

    it('creates the visitor when the toggle is on and the branch is valid', async () => {
      mockConfig.isFeatureEnabled.mockResolvedValue(true);
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.visitor.create.mockResolvedValue({ id: 'visitor-1' });

      await service.registerPublic(TENANT_ID, registerDto as any);

      expect(mockPrisma.visitor.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_ID, branchId: 'branch-1', firstName: 'Alice' }) }),
      );
    });
  });

  describe('listBranchOptionsForRegistration', () => {
    it('returns only active, non-deleted branches with a minimal projection', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([{ id: 'branch-1', name: 'HQ', branchType: 'headquarters', parentBranchId: null }]);

      const result = await service.listBranchOptionsForRegistration(TENANT_ID);

      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID, isActive: true, deletedAt: null } }),
      );
      expect(result).toEqual([{ id: 'branch-1', name: 'HQ', branchType: 'headquarters', parentBranchId: null }]);
    });
  });

  describe('update', () => {
    it('rejects setting status to "joined" directly', async () => {
      mockPrisma.visitor.findFirst.mockResolvedValue({ id: 'visitor-1', status: 'contacted' });

      await expect(service.update(TENANT_ID, 'visitor-1', { status: 'joined' } as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.visitor.update).not.toHaveBeenCalled();
    });

    it('accepts every other status transition', async () => {
      mockPrisma.visitor.findFirst.mockResolvedValue({ id: 'visitor-1', status: 'new' });
      mockPrisma.visitor.update.mockResolvedValue({ id: 'visitor-1', status: 'contacted' });

      await service.update(TENANT_ID, 'visitor-1', { status: 'contacted' } as any);

      expect(mockPrisma.visitor.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'contacted' }) }),
      );
    });
  });

  describe('convertToMember', () => {
    it('rejects a visitor that has already been converted', async () => {
      mockPrisma.visitor.findFirst.mockResolvedValue({ id: 'visitor-1', convertedMemberId: 'member-1' });

      await expect(service.convertToMember(TENANT_ID, 'visitor-1', 'member-2', 'user-1', 'Joined the church.')).rejects.toThrow(BadRequestException);
    });

    it('rejects when the target member does not resolve within the tenant', async () => {
      mockPrisma.visitor.findFirst.mockResolvedValueOnce({ id: 'visitor-1', convertedMemberId: null });
      mockPrisma.member.findFirst.mockResolvedValue(null);

      await expect(service.convertToMember(TENANT_ID, 'visitor-1', 'member-2', 'user-1', 'Joined the church.')).rejects.toThrow(NotFoundException);
    });

    it('rejects when the target member is already linked to a different visitor', async () => {
      mockPrisma.visitor.findFirst
        .mockResolvedValueOnce({ id: 'visitor-1', convertedMemberId: null })
        .mockResolvedValueOnce({ id: 'visitor-2', convertedMemberId: 'member-2' });
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-2' });

      await expect(service.convertToMember(TENANT_ID, 'visitor-1', 'member-2', 'user-1', 'Joined the church.')).rejects.toThrow(ConflictException);
    });

    it('sets status to joined, links convertedMemberId, and audits the reason on success', async () => {
      mockPrisma.visitor.findFirst
        .mockResolvedValueOnce({ id: 'visitor-1', status: 'contacted', convertedMemberId: null })
        .mockResolvedValueOnce(null);
      mockPrisma.member.findFirst.mockResolvedValue({ id: 'member-2' });
      mockPrisma.visitor.update.mockResolvedValue({ id: 'visitor-1', status: 'joined', convertedMemberId: 'member-2' });

      await service.convertToMember(TENANT_ID, 'visitor-1', 'member-2', 'user-1', 'Joined the church.');

      expect(mockAudit.record).toHaveBeenCalledWith(
        TENANT_ID,
        'user-1',
        'visitor.converted',
        'visitor',
        'visitor-1',
        expect.objectContaining({ reason: 'Joined the church.' }),
      );
      expect(mockPrisma.visitor.update).toHaveBeenCalledWith({
        where: { id: 'visitor-1' },
        data: { status: 'joined', convertedMemberId: 'member-2' },
      });
    });
  });

  describe('findAllForExport', () => {
    it('applies the same filters as findAll but with no pagination, capped at 5000 rows', async () => {
      mockPrisma.visitor.findMany.mockResolvedValue([{ id: 'visitor-1' }, { id: 'visitor-2' }]);

      const result = await service.findAllForExport(TENANT_ID, { status: 'new' } as any);

      expect(mockPrisma.visitor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, status: 'new' }),
          take: 5000,
        }),
      );
      expect(mockPrisma.visitor.findMany.mock.calls[0][0]).not.toHaveProperty('skip');
      expect(result).toHaveLength(2);
    });
  });
});
