import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeadlinesService } from '../src/deadlines/deadlines.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';

describe('DeadlinesService', () => {
  let service: DeadlinesService;

  const TENANT_ID = 'tenant-1';

  const mockPrisma = {
    deadline: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };

  const mockAuditService = { record: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DeadlinesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();
    service = moduleRef.get(DeadlinesService);
  });

  describe('effectiveStatus', () => {
    it('reports "closed" once closed, regardless of dueAt', () => {
      const result = service.effectiveStatus({ status: 'closed', dueAt: new Date(Date.now() + 100000) } as any);
      expect(result).toBe('closed');
    });

    it('reports "locked" when open but dueAt has passed', () => {
      const result = service.effectiveStatus({ status: 'open', dueAt: new Date(Date.now() - 1000) } as any);
      expect(result).toBe('locked');
    });

    it('reports "open" when open and dueAt is in the future', () => {
      const result = service.effectiveStatus({ status: 'open', dueAt: new Date(Date.now() + 100000) } as any);
      expect(result).toBe('open');
    });
  });

  describe('assertOpen', () => {
    it('does nothing when no deadline is configured for the entity', async () => {
      mockPrisma.deadline.findUnique.mockResolvedValue(null);
      await expect(service.assertOpen(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1')).resolves.toBeUndefined();
    });

    it('rejects when the deadline is locked', async () => {
      mockPrisma.deadline.findUnique.mockResolvedValue({ status: 'open', dueAt: new Date(Date.now() - 1000) });
      await expect(service.assertOpen(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when the deadline is closed', async () => {
      mockPrisma.deadline.findUnique.mockResolvedValue({ status: 'closed', dueAt: new Date(Date.now() + 100000) });
      await expect(service.assertOpen(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('passes when the deadline is open and not yet due', async () => {
      mockPrisma.deadline.findUnique.mockResolvedValue({ status: 'open', dueAt: new Date(Date.now() + 100000) });
      await expect(service.assertOpen(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1')).resolves.toBeUndefined();
    });
  });

  describe('extend', () => {
    it('rejects when the deadline does not exist', async () => {
      mockPrisma.deadline.findUnique.mockResolvedValue(null);
      await expect(
        service.extend(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1', 'user-1', '2026-08-01', 'More time needed.'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the deadline is not currently locked', async () => {
      mockPrisma.deadline.findUnique.mockResolvedValue({ id: 'd-1', status: 'open', dueAt: new Date(Date.now() + 100000) });
      await expect(
        service.extend(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1', 'user-1', '2026-08-01', 'More time needed.'),
      ).rejects.toThrow(BadRequestException);
    });

    it('pushes dueAt forward and records who/why', async () => {
      mockPrisma.deadline.findUnique.mockResolvedValue({ id: 'd-1', status: 'open', dueAt: new Date(Date.now() - 1000) });
      mockPrisma.deadline.update.mockResolvedValue({ id: 'd-1', dueAt: new Date('2026-08-01') });

      await service.extend(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1', 'user-1', '2026-08-01', 'More time needed.');

      expect(mockPrisma.deadline.update).toHaveBeenCalledWith({
        where: { id: 'd-1' },
        data: { dueAt: new Date('2026-08-01'), extendedByUserId: 'user-1', extensionReason: 'More time needed.' },
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        TENANT_ID,
        'user-1',
        'deadline.extended',
        'hierarchy_requirement_submission',
        'sub-1',
        expect.objectContaining({ reason: 'More time needed.' }),
      );
    });
  });

  describe('close', () => {
    it('rejects when already closed', async () => {
      mockPrisma.deadline.findUnique.mockResolvedValue({ id: 'd-1', status: 'closed' });
      await expect(
        service.close(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1', 'user-1', 'Cycle ended.'),
      ).rejects.toThrow(BadRequestException);
    });

    it('closes an open or locked deadline', async () => {
      mockPrisma.deadline.findUnique.mockResolvedValue({ id: 'd-1', status: 'open' });
      mockPrisma.deadline.update.mockResolvedValue({ id: 'd-1', status: 'closed' });

      await service.close(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1', 'user-1', 'Cycle ended.');

      expect(mockPrisma.deadline.update).toHaveBeenCalledWith({
        where: { id: 'd-1' },
        data: { status: 'closed', closedAt: expect.any(Date) },
      });
    });
  });

  describe('reopen', () => {
    it('rejects when not currently closed', async () => {
      mockPrisma.deadline.findUnique.mockResolvedValue({ id: 'd-1', status: 'open' });
      await expect(
        service.reopen(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1', 'user-1', 'Reopening by exception.'),
      ).rejects.toThrow(BadRequestException);
    });

    it('reopens a closed deadline', async () => {
      mockPrisma.deadline.findUnique.mockResolvedValue({ id: 'd-1', status: 'closed' });
      mockPrisma.deadline.update.mockResolvedValue({ id: 'd-1', status: 'open' });

      await service.reopen(TENANT_ID, 'hierarchy_requirement_submission', 'sub-1', 'user-1', 'Reopening by exception.');

      expect(mockPrisma.deadline.update).toHaveBeenCalledWith({
        where: { id: 'd-1' },
        data: { status: 'open', closedAt: null },
      });
    });
  });
});
