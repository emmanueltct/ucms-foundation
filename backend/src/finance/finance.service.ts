import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Contribution, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { UpdateContributionDto } from './dto/update-contribution.dto';
import { ContributionQueryDto } from './dto/contribution-query.dto';
import { resolveBranchFilter } from '../common/branch-scope/branch-visibility.util';
import { NumberingSequencesService } from '../numbering-sequences/numbering-sequences.service';

/** NumberingSequence key a tenant can optionally configure to auto-fill receiptNumber when left blank. */
const RECEIPT_NUMBER_SEQUENCE_KEY = 'contribution_receipt_number';

/**
 * Contribution recording — see docs/finance/business-analysis.md. Unlike
 * every other module, there is no delete/soft-delete path here: a
 * contribution is either exactly as recorded, or explicitly voided with a
 * reason, so the audit trail a Finance Officer relies on never silently
 * changes shape.
 */
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingSequences: NumberingSequencesService,
  ) {}

  async create(tenantId: string, recordedByUserId: string | undefined, dto: CreateContributionDto): Promise<Contribution> {
    await this.assertBranchExists(tenantId, dto.branchId);
    if (dto.memberId) {
      await this.assertMemberExists(tenantId, dto.memberId);
    }
    if (dto.receiptNumber) {
      await this.assertReceiptNumberFree(tenantId, dto.receiptNumber);
    }

    const currency = dto.currency ?? (await this.tenantCurrency(tenantId));
    // Auto-fill only when left blank and a sequence is configured — manual entry always wins.
    const receiptNumber = dto.receiptNumber ?? (await this.numberingSequences.getNext(tenantId, RECEIPT_NUMBER_SEQUENCE_KEY)) ?? undefined;

    return this.prisma.contribution.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        memberId: dto.memberId ?? null,
        contributionType: dto.contributionType,
        amount: dto.amount,
        currency,
        paymentMethod: dto.paymentMethod,
        receiptNumber,
        contributedAt: new Date(dto.contributedAt),
        recordedByUserId,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: ContributionQueryDto, visibleBranchIds: string[] | null = null) {
    const where = this.buildWhere(tenantId, query, visibleBranchIds);

    const [items, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { contributedAt: 'desc' },
      }),
      this.prisma.contribution.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<Contribution> {
    const contribution = await this.prisma.contribution.findFirst({ where: { id, tenantId } });
    if (!contribution) {
      throw new NotFoundException({ code: 'CONTRIBUTION_NOT_FOUND', message: 'Contribution not found.' });
    }
    return contribution;
  }

  /** Only notes/receiptNumber are mutable in place (FR-FIN-3.1) — everything else requires voiding instead. */
  async update(tenantId: string, id: string, dto: UpdateContributionDto): Promise<Contribution> {
    const existing = await this.findOne(tenantId, id);
    if (dto.receiptNumber && dto.receiptNumber !== existing.receiptNumber) {
      await this.assertReceiptNumberFree(tenantId, dto.receiptNumber);
    }

    return this.prisma.contribution.update({
      where: { id },
      data: { notes: dto.notes, receiptNumber: dto.receiptNumber },
    });
  }

  async void(tenantId: string, id: string, voidedByUserId: string | undefined, voidReason: string): Promise<Contribution> {
    const existing = await this.findOne(tenantId, id);
    if (existing.isVoided) {
      throw new BadRequestException({
        code: 'CONTRIBUTION_ALREADY_VOIDED',
        message: 'This contribution has already been voided.',
      });
    }

    return this.prisma.contribution.update({
      where: { id },
      data: { isVoided: true, voidedAt: new Date(), voidReason, voidedByUserId },
    });
  }

  /** Totals grouped by contribution type, for the same filters as findAll (FR-FIN-2.3). */
  async summary(tenantId: string, query: ContributionQueryDto, visibleBranchIds: string[] | null = null) {
    const where = this.buildWhere(tenantId, query, visibleBranchIds);

    const grouped = await this.prisma.contribution.groupBy({
      by: ['contributionType'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { contributionType: 'asc' },
    });

    return grouped.map((g) => ({
      contributionType: g.contributionType,
      total: g._sum.amount ?? 0,
      count: g._count._all,
    }));
  }

  private buildWhere(tenantId: string, query: ContributionQueryDto, visibleBranchIds: string[] | null = null): Prisma.ContributionWhereInput {
    return {
      tenantId,
      ...(query.includeVoided ? {} : { isVoided: false }),
      ...resolveBranchFilter(query.branchId, visibleBranchIds),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.contributionType ? { contributionType: query.contributionType } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            contributedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };
  }

  private async assertBranchExists(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
  }

  private async assertMemberExists(tenantId: string, memberId: string): Promise<void> {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId, deletedAt: null } });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
  }

  private async assertReceiptNumberFree(tenantId: string, receiptNumber: string): Promise<void> {
    const existing = await this.prisma.contribution.findFirst({ where: { tenantId, receiptNumber } });
    if (existing) {
      throw new ConflictException({
        code: 'RECEIPT_NUMBER_TAKEN',
        message: `Receipt number "${receiptNumber}" is already in use.`,
      });
    }
  }

  private async tenantCurrency(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
    return tenant?.currency ?? 'RWF';
  }
}
