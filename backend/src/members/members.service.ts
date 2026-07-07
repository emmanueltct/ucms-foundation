import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Member } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';

/**
 * Member profiles — see docs/member-management/business-analysis.md. Every
 * member belongs to exactly one Branch (Module 1) and optionally one Family;
 * branch changes only happen through `transfer` (mirrors Branch's `move`).
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
  ) {}

  async create(tenantId: string, dto: CreateMemberDto): Promise<Member> {
    await this.assertBranchExists(tenantId, dto.branchId);
    if (dto.familyId) {
      await this.familiesService.findOne(tenantId, dto.familyId);
    }
    if (dto.membershipNumber) {
      await this.assertMembershipNumberFree(tenantId, dto.membershipNumber);
    }

    return this.prisma.member.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        familyId: dto.familyId ?? null,
        familyRole: dto.familyRole,
        membershipNumber: dto.membershipNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        maritalStatus: dto.maritalStatus,
        membershipCategory: dto.membershipCategory,
        membershipStatus: dto.membershipStatus ?? 'active',
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
        baptismDate: dto.baptismDate ? new Date(dto.baptismDate) : undefined,
        photoUrl: dto.photoUrl,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: MemberQueryDto) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.familyId ? { familyId: query.familyId } : {}),
      ...(query.membershipStatus ? { membershipStatus: query.membershipStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search, mode: 'insensitive' as const } },
              { membershipNumber: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.member.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<Member> {
    const member = await this.prisma.member.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
    return member;
  }

  async update(tenantId: string, id: string, dto: UpdateMemberDto): Promise<Member> {
    const existing = await this.findOne(tenantId, id);

    if (dto.familyId) {
      await this.familiesService.findOne(tenantId, dto.familyId);
    }
    if (dto.membershipNumber && dto.membershipNumber !== existing.membershipNumber) {
      await this.assertMembershipNumberFree(tenantId, dto.membershipNumber);
    }
    // Moved out of (or reassigned away from) its family — the old family shouldn't keep pointing at this member as its head.
    if (dto.familyId !== undefined && dto.familyId !== existing.familyId) {
      await this.familiesService.clearHeadIfMember(tenantId, id);
    }

    return this.prisma.member.update({
      where: { id },
      data: {
        familyId: dto.familyId,
        familyRole: dto.familyRole,
        membershipNumber: dto.membershipNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        maritalStatus: dto.maritalStatus,
        membershipCategory: dto.membershipCategory,
        membershipStatus: dto.membershipStatus,
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
        baptismDate: dto.baptismDate ? new Date(dto.baptismDate) : undefined,
        photoUrl: dto.photoUrl,
        notes: dto.notes,
      },
    });
  }

  /** Moves a member to a different branch — the only way `branchId` ever changes (FR-MM-2). */
  async transfer(tenantId: string, id: string, branchId: string): Promise<Member> {
    await this.findOne(tenantId, id);
    await this.assertBranchExists(tenantId, branchId);
    return this.prisma.member.update({ where: { id }, data: { branchId } });
  }

  /** Soft-deletes the member and clears any family's headOfFamilyId pointing at them (FR-MM-1.8). */
  async softDelete(tenantId: string, id: string): Promise<Member> {
    await this.findOne(tenantId, id);
    await this.familiesService.clearHeadIfMember(tenantId, id);
    return this.prisma.member.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  private async assertBranchExists(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
  }

  private async assertMembershipNumberFree(tenantId: string, membershipNumber: string): Promise<void> {
    const existing = await this.prisma.member.findFirst({ where: { tenantId, membershipNumber, deletedAt: null } });
    if (existing) {
      throw new ConflictException({
        code: 'MEMBERSHIP_NUMBER_TAKEN',
        message: `Membership number "${membershipNumber}" is already in use.`,
      });
    }
  }
}
