import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Member } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { resolveBranchFilter } from '../common/branch-scope/branch-visibility.util';

export type MemberWithCustomFields = Member & { customFields: Record<string, unknown> };

/** entityType key this module registers its records under with the Custom Fields module. */
const CUSTOM_FIELD_ENTITY_TYPE = 'member';

/**
 * Member profiles — see docs/member-management/business-analysis.md. Every
 * member belongs to exactly one Branch (Module 1) and optionally one Family;
 * branch changes only happen through `transfer` (mirrors Branch's `move`).
 *
 * The flagship integration of the Custom Fields module (see
 * docs/custom-fields/business-analysis.md): a tenant's `customFields` for
 * "member" are validated and persisted alongside the fixed core fields, and
 * returned on every read, without this table ever changing shape.
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
    private readonly customFieldsService: CustomFieldsService,
  ) {}

  async create(tenantId: string, dto: CreateMemberDto): Promise<MemberWithCustomFields> {
    await this.assertBranchExists(tenantId, dto.branchId);
    if (dto.familyId) {
      await this.familiesService.findOne(tenantId, dto.familyId);
    }
    if (dto.membershipNumber) {
      await this.assertMembershipNumberFree(tenantId, dto.membershipNumber);
    }
    // Fail before writing the member row at all if a required custom field is missing.
    await this.customFieldsService.assertRequiredFieldsProvided(tenantId, CUSTOM_FIELD_ENTITY_TYPE, dto.customFields);

    const member = await this.prisma.member.create({
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

    if (dto.customFields) {
      await this.customFieldsService.setValues(tenantId, CUSTOM_FIELD_ENTITY_TYPE, member.id, dto.customFields);
    }

    return { ...member, customFields: dto.customFields ?? {} };
  }

  async findAll(tenantId: string, query: MemberQueryDto, visibleBranchIds: string[] | null = null) {
    const where = this.buildWhere(tenantId, query, visibleBranchIds);

    const [items, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.member.count({ where }),
    ]);

    return { items: await this.withCustomFields(tenantId, items), total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  /** Same filters as `findAll`, uncapped (up to 5000 rows) — backs the CSV/XLSX/PDF export endpoint. */
  async findAllForExport(tenantId: string, query: MemberQueryDto, visibleBranchIds: string[] | null = null): Promise<MemberWithCustomFields[]> {
    const where = this.buildWhere(tenantId, query, visibleBranchIds);
    const items = await this.prisma.member.findMany({
      where,
      take: 5000,
      orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return this.withCustomFields(tenantId, items);
  }

  /**
   * `visibleBranchIds` (from `BranchScopeService.resolveVisibleBranchIds`) is
   * `null` for unrestricted/church-wide callers — the default for every
   * tenant that hasn't assigned `User.assignedBranchId`, so this is a no-op
   * unless a tenant actively opts into per-user branch assignment.
   */
  private buildWhere(tenantId: string, query: MemberQueryDto, visibleBranchIds: string[] | null = null) {
    return {
      tenantId,
      deletedAt: null,
      ...resolveBranchFilter(query.branchId, visibleBranchIds),
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
  }

  private async withCustomFields(tenantId: string, items: Member[]): Promise<MemberWithCustomFields[]> {
    const customFieldsByMemberId = await this.customFieldsService.getValuesForMany(
      tenantId,
      CUSTOM_FIELD_ENTITY_TYPE,
      items.map((m) => m.id),
    );
    return items.map((m) => ({ ...m, customFields: customFieldsByMemberId[m.id] ?? {} }));
  }

  async findOne(tenantId: string, id: string): Promise<MemberWithCustomFields> {
    const member = await this.findOneRaw(tenantId, id);
    const customFields = await this.customFieldsService.getValues(tenantId, CUSTOM_FIELD_ENTITY_TYPE, id);
    return { ...member, customFields };
  }

  private async findOneRaw(tenantId: string, id: string): Promise<Member> {
    const member = await this.prisma.member.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
    return member;
  }

  async update(tenantId: string, id: string, dto: UpdateMemberDto): Promise<MemberWithCustomFields> {
    const existing = await this.findOneRaw(tenantId, id);

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

    const updated = await this.prisma.member.update({
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

    if (dto.customFields) {
      await this.customFieldsService.setValues(tenantId, CUSTOM_FIELD_ENTITY_TYPE, id, dto.customFields);
    }
    const customFields = await this.customFieldsService.getValues(tenantId, CUSTOM_FIELD_ENTITY_TYPE, id);

    return { ...updated, customFields };
  }

  /** Moves a member to a different branch — the only way `branchId` ever changes (FR-MM-2). */
  async transfer(tenantId: string, id: string, branchId: string): Promise<Member> {
    await this.findOneRaw(tenantId, id);
    await this.assertBranchExists(tenantId, branchId);
    return this.prisma.member.update({ where: { id }, data: { branchId } });
  }

  /** Soft-deletes the member and clears any family's headOfFamilyId pointing at them (FR-MM-1.8). */
  async softDelete(tenantId: string, id: string): Promise<Member> {
    await this.findOneRaw(tenantId, id);
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
