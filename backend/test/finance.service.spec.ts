import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FinanceService } from '../src/finance/finance.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { NumberingSequencesService } from '../src/numbering-sequences/numbering-sequences.service';

describe('FinanceService', () => {
  let service: FinanceService;

  const TENANT_ID = 'tenant-1';
  const USER_ID = 'user-1';

  const mockPrisma = {
    contribution: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    branch: { findFirst: jest.fn() },
    member: { findFirst: jest.fn() },
    tenant: { findUnique: jest.fn() },
  };

  const mockNumberingSequences = { getNext: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    // No sequence configured by default — existing tests' manual receiptNumber values pass through unchanged.
    mockNumberingSequences.getNext.mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NumberingSequencesService, useValue: mockNumberingSequences },
      ],
    }).compile();
    service = moduleRef.get(FinanceService);
  });

  describe('create', () => {
    const baseDto = {
      branchId: 'branch-1',
      contributionType: 'tithe',
      amount: 25000,
      paymentMethod: 'cash',
      contributedAt: '2026-07-05',
    };

    it('rejects when branchId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);
      await expect(service.create(TENANT_ID, USER_ID, baseDto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects when memberId does not resolve within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await expect(service.create(TENANT_ID, USER_ID, { ...baseDto, memberId: 'missing' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a duplicate receiptNumber within the tenant', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.contribution.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create(TENANT_ID, USER_ID, { ...baseDto, receiptNumber: 'RCT-0001' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('defaults currency to the tenant currency when omitted', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.contribution.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({ currency: 'RWF' });
      mockPrisma.contribution.create.mockResolvedValue({ id: 'contrib-1' });

      await service.create(TENANT_ID, USER_ID, baseDto as any);

      expect(mockPrisma.contribution.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currency: 'RWF', recordedByUserId: USER_ID }) }),
      );
    });

    it('uses an explicit currency instead of the tenant default when provided', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.contribution.findFirst.mockResolvedValue(null);
      mockPrisma.contribution.create.mockResolvedValue({ id: 'contrib-1' });

      await service.create(TENANT_ID, USER_ID, { ...baseDto, currency: 'USD' } as any);

      expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.contribution.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currency: 'USD' }) }),
      );
    });
  });

  describe('update', () => {
    it('only ever writes notes/receiptNumber, regardless of what else might be passed', async () => {
      mockPrisma.contribution.findFirst
        .mockResolvedValueOnce({ id: 'contrib-1', tenantId: TENANT_ID, receiptNumber: null })
        .mockResolvedValueOnce(null);
      mockPrisma.contribution.update.mockResolvedValue({ id: 'contrib-1' });

      await service.update(TENANT_ID, 'contrib-1', { notes: 'Corrected spelling', receiptNumber: 'RCT-0002' });

      expect(mockPrisma.contribution.update).toHaveBeenCalledWith({
        where: { id: 'contrib-1' },
        data: { notes: 'Corrected spelling', receiptNumber: 'RCT-0002' },
      });
    });

    it('rejects a receiptNumber change to one already taken by another contribution', async () => {
      mockPrisma.contribution.findFirst
        .mockResolvedValueOnce({ id: 'contrib-1', tenantId: TENANT_ID, receiptNumber: 'RCT-0001' })
        .mockResolvedValueOnce({ id: 'other-contrib' });

      await expect(service.update(TENANT_ID, 'contrib-1', { receiptNumber: 'RCT-0002' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('void', () => {
    it('rejects voiding an already-voided contribution', async () => {
      mockPrisma.contribution.findFirst.mockResolvedValue({ id: 'contrib-1', tenantId: TENANT_ID, isVoided: true });
      await expect(service.void(TENANT_ID, 'contrib-1', USER_ID, 'duplicate')).rejects.toThrow(BadRequestException);
    });

    it('voids an active contribution with a reason and the acting user', async () => {
      mockPrisma.contribution.findFirst.mockResolvedValue({ id: 'contrib-1', tenantId: TENANT_ID, isVoided: false });
      mockPrisma.contribution.update.mockResolvedValue({ id: 'contrib-1', isVoided: true });

      await service.void(TENANT_ID, 'contrib-1', USER_ID, 'Duplicate entry');

      expect(mockPrisma.contribution.update).toHaveBeenCalledWith({
        where: { id: 'contrib-1' },
        data: { isVoided: true, voidedAt: expect.any(Date), voidReason: 'Duplicate entry', voidedByUserId: USER_ID },
      });
    });
  });

  describe('findAll / summary filters', () => {
    it('excludes voided contributions by default', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.contribution.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { page: 1, pageSize: 20, includeVoided: false } as any);

      expect(mockPrisma.contribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, isVoided: false }) }),
      );
    });

    it('includes voided contributions when includeVoided is true', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.contribution.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { page: 1, pageSize: 20, includeVoided: true } as any);

      const callArgs = mockPrisma.contribution.findMany.mock.calls[0][0];
      expect(callArgs.where.isVoided).toBeUndefined();
    });

    it('summary groups totals by contributionType', async () => {
      mockPrisma.contribution.groupBy.mockResolvedValue([
        { contributionType: 'tithe', _sum: { amount: 150000 }, _count: { _all: 12 } },
        { contributionType: 'offering', _sum: { amount: 42000 }, _count: { _all: 30 } },
      ]);

      const result = await service.summary(TENANT_ID, { page: 1, pageSize: 20, includeVoided: false } as any);

      expect(result).toEqual([
        { contributionType: 'tithe', total: 150000, count: 12 },
        { contributionType: 'offering', total: 42000, count: 30 },
      ]);
    });
  });
});
