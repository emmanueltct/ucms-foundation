import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Visitor, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { VisitorQueryDto } from './dto/visitor-query.dto';
import { resolveBranchFilter } from '../common/branch-scope/branch-visibility.util';

/**
 * Visitors — see docs/visitor-management/business-analysis.md. `status` is a
 * plain, freely-editable lifecycle field (`update`) except for "joined",
 * which only ever happens through `convertToMember` since it also links
 * `convertedMemberId` — the same "a field with real side effects gets its
 * own dedicated action" reasoning `Member.transfer`/`Family.setHead` use.
 * Activity logging (First Visit, Counseling, Follow-up, ...) lives in
 * `VisitorActivitiesService`, shared with `VisitorGroupsService`.
 */
@Injectable()
export class VisitorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateVisitorDto): Promise<Visitor> {
    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }
    if (dto.invitedByMemberId) {
      await this.assertMemberExists(tenantId, dto.invitedByMemberId);
    }
    if (dto.visitorGroupId) {
      await this.assertVisitorGroupExists(tenantId, dto.visitorGroupId);
    }

    return this.prisma.visitor.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        visitorGroupId: dto.visitorGroupId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        visitDate: new Date(dto.visitDate),
        source: dto.source,
        invitedByMemberId: dto.invitedByMemberId,
        assignedToUserId: dto.assignedToUserId,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: VisitorQueryDto, visibleBranchIds: string[] | null = null) {
    const where = this.buildWhere(tenantId, query, visibleBranchIds);

    const [items, total] = await Promise.all([
      this.prisma.visitor.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { visitDate: 'desc' },
      }),
      this.prisma.visitor.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  /** Same filters as `findAll`, uncapped (up to 5000 rows) — backs the CSV/XLSX/PDF export endpoint. */
  async findAllForExport(tenantId: string, query: VisitorQueryDto, visibleBranchIds: string[] | null = null): Promise<Visitor[]> {
    const where = this.buildWhere(tenantId, query, visibleBranchIds);
    return this.prisma.visitor.findMany({
      where,
      take: 5000,
      orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { visitDate: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Visitor> {
    return this.findOneRaw(tenantId, id);
  }

  async update(tenantId: string, id: string, dto: UpdateVisitorDto): Promise<Visitor> {
    await this.findOneRaw(tenantId, id);

    if (dto.status === 'joined') {
      throw new BadRequestException({
        code: 'VISITOR_USE_CONVERT_ENDPOINT',
        message: 'Use POST /visitors/:id/convert to mark a visitor as joined — it also links the resulting member.',
      });
    }
    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }
    if (dto.invitedByMemberId) {
      await this.assertMemberExists(tenantId, dto.invitedByMemberId);
    }
    if (dto.visitorGroupId) {
      await this.assertVisitorGroupExists(tenantId, dto.visitorGroupId);
    }

    return this.prisma.visitor.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        visitorGroupId: dto.visitorGroupId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
        source: dto.source,
        invitedByMemberId: dto.invitedByMemberId,
        assignedToUserId: dto.assignedToUserId,
        status: dto.status,
        notes: dto.notes,
      },
    });
  }

  async softDelete(tenantId: string, id: string): Promise<Visitor> {
    await this.findOneRaw(tenantId, id);
    return this.prisma.visitor.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Links this visitor to an already-created Member and marks them "joined" — the one legitimate way `status` becomes "joined". */
  async convertToMember(tenantId: string, id: string, memberId: string): Promise<Visitor> {
    const visitor = await this.findOneRaw(tenantId, id);
    if (visitor.convertedMemberId) {
      throw new BadRequestException({
        code: 'VISITOR_ALREADY_CONVERTED',
        message: 'This visitor has already been converted to a member.',
      });
    }
    await this.assertMemberExists(tenantId, memberId);
    const memberAlreadyLinked = await this.prisma.visitor.findFirst({ where: { tenantId, convertedMemberId: memberId } });
    if (memberAlreadyLinked) {
      throw new ConflictException({
        code: 'MEMBER_ALREADY_LINKED_TO_VISITOR',
        message: 'This member is already linked to a different visitor record.',
      });
    }

    return this.prisma.visitor.update({
      where: { id },
      data: { status: 'joined', convertedMemberId: memberId },
    });
  }

  private async findOneRaw(tenantId: string, id: string): Promise<Visitor> {
    const visitor = await this.prisma.visitor.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!visitor) throw new NotFoundException({ code: 'VISITOR_NOT_FOUND', message: 'Visitor not found.' });
    return visitor;
  }

  private buildWhere(tenantId: string, query: VisitorQueryDto, visibleBranchIds: string[] | null = null): Prisma.VisitorWhereInput {
    return {
      tenantId,
      deletedAt: null,
      ...resolveBranchFilter(query.branchId, visibleBranchIds),
      ...(query.status ? { status: query.status } : {}),
      ...(query.assignedToUserId ? { assignedToUserId: query.assignedToUserId } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
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

  private async assertVisitorGroupExists(tenantId: string, visitorGroupId: string): Promise<void> {
    const group = await this.prisma.visitorGroup.findFirst({ where: { id: visitorGroupId, tenantId, deletedAt: null } });
    if (!group) throw new NotFoundException({ code: 'VISITOR_GROUP_NOT_FOUND', message: 'Visitor group not found.' });
  }
}
