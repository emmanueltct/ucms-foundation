import { randomBytes } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { DynamicModuleDefinitionsService } from '../dynamic-modules/dynamic-module-definitions.service';

/** Must match `DEPARTMENTS_MODULE_KEY` in `../departments/departments.service.ts` — not imported directly to avoid a cross-module coupling for one string constant. */
const DEPARTMENTS_MODULE_KEY = 'departments';

/**
 * Platform-Admin-only operations. Provisions and manages tenants themselves
 * — distinct from anything running *inside* a tenant's own context.
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamicModuleDefinitions: DynamicModuleDefinitionsService,
  ) {}

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException({ code: 'SLUG_TAKEN', message: `Slug "${dto.slug}" is already in use.` });
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        currency: dto.currency ?? 'RWF',
        language: dto.language ?? 'en',
        timezone: dto.timezone ?? 'Africa/Kigali',
        subscriptionPlan: dto.subscriptionPlan ?? 'free',
      },
    });

    if (!dto.adminEmail) {
      return { tenant, temporaryPassword: null };
    }

    const temporaryPassword = await this.bootstrapAdminUser(tenant.id, tenant.name, dto.adminEmail);
    return { tenant, temporaryPassword };
  }

  /**
   * Provisions the tenant's first "Church Administrator" role + user so the
   * onboarding wizard's "first admin user" step has someone to log in with.
   * Only tenant-scoped permission codes are granted here (module !==
   * "platform") — the global platform.tenant.* codes stay platform-admin-only,
   * unlike the demo seed's role (which intentionally grants every permission
   * for local-dev convenience only).
   */
  private async bootstrapAdminUser(tenantId: string, tenantName: string, adminEmail: string): Promise<string> {
    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const tenantPermissions = await this.prisma.permission.findMany({ where: { module: { not: 'platform' } } });
    const adminRole = await this.prisma.role.create({
      data: {
        tenantId,
        name: 'Church Administrator',
        description: 'Full access within this church tenant',
        isSystem: true,
        rolePermissions: { create: tenantPermissions.map((p) => ({ permissionId: p.id })) },
      },
    });

    // Pre-seeded so Department Leader features (Phase 7) are never in a
    // broken "no departments module exists yet" state — a Denomination
    // Admin creates department records ("Finance", "HR", ...) into this the
    // same way they'd create any Dynamic Module record. Runs after
    // `adminRole` exists so DynamicModuleDefinitionsService.create's
    // permission grant (to every isSystem role) reaches this tenant's new
    // Church Administrator role too.
    await this.dynamicModuleDefinitions.create(tenantId, {
      key: DEPARTMENTS_MODULE_KEY,
      label: 'Departments',
      description: 'Finance, HR, Customer Care, Logistics, or any custom department this church needs.',
      showInNav: true,
    });

    await this.prisma.user.create({
      data: {
        tenantId,
        email: adminEmail,
        passwordHash,
        firstName: 'Church',
        lastName: 'Administrator',
        userRoles: { create: [{ roleId: adminRole.id }] },
      },
    });

    await this.seedDefaultOrgStructure(tenantId, tenantName);

    return temporaryPassword;
  }

  /**
   * For brand-new tenants only — never backfilled onto an existing tenant,
   * so this can't retroactively constrain a church that already built its
   * own hierarchy. Reproduces the reference org-chart's shape (Top Level ->
   * Branch -> Sub-Branch -> Sub-Branch...) as a default, fully editable
   * template: three `HierarchyLevelDefinition` rows (inert rules layered
   * over `Branch.branchType`, see that model's own doc comment) plus one
   * root `Branch` so a new tenant starts with a visible apex node instead of
   * an empty tree. `sub_branch` deliberately allows itself as both parent
   * and child, satisfying "every organizational unit below Branch is a
   * Sub-Branch" with unlimited further nesting. `sub_branch`'s `color` is
   * left unset on purpose — the frontend's depth-based fallback rotation
   * then naturally colors successive Sub-Branch tiers differently (purple,
   * then orange, ...) exactly like the reference diagram's tiers 3/4,
   * without needing a color-per-depth concept in the schema.
   */
  private async seedDefaultOrgStructure(tenantId: string, tenantName: string): Promise<void> {
    const branchTypes: Array<{ key: string; label: string }> = [
      { key: 'top_level', label: 'Top Level' },
      { key: 'branch', label: 'Branch' },
      { key: 'sub_branch', label: 'Sub Branch' },
    ];
    await this.prisma.configItem.createMany({
      data: branchTypes.map((t, i) => ({ tenantId, namespace: 'branch_type', key: t.key, label: t.label, value: {}, sortOrder: i })),
    });

    await this.prisma.hierarchyLevelDefinition.createMany({
      data: [
        { tenantId, branchTypeKey: 'top_level', label: 'Top Level', allowedParentTypeKeys: [], allowedChildTypeKeys: ['branch'], color: '#2563EB', sortOrder: 0 },
        { tenantId, branchTypeKey: 'branch', label: 'Branch', allowedParentTypeKeys: ['top_level'], allowedChildTypeKeys: ['sub_branch'], color: '#16A34A', sortOrder: 1 },
        { tenantId, branchTypeKey: 'sub_branch', label: 'Sub Branch', allowedParentTypeKeys: ['branch', 'sub_branch'], allowedChildTypeKeys: ['sub_branch'], sortOrder: 2 },
      ],
    });

    await this.prisma.branch.create({
      data: { tenantId, name: `${tenantName} Head Office`, branchType: 'top_level', isHeadquarters: true },
    });
  }

  async findAll(query: PaginationQueryDto) {
    const where = query.search
      ? { name: { contains: query.search, mode: 'insensitive' as const }, deletedAt: null }
      : { deletedAt: null };

    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  /**
   * Deliberately does NOT filter out soft-deleted tenants (unlike `findAll`)
   * — this is a targeted by-id lookup, and the detail page needs to keep
   * showing a soft-deleted church (with its Restore/Permanently-delete
   * actions) after `softDelete` runs, not 404 it into invisibility.
   */
  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Church not found.' });
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data: { isActive: false } });
  }

  /** Reverses `deactivate` — a suspended church keeps every row it had, this just flips the flag back. */
  async reactivate(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data: { isActive: true } });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /**
   * Reverses `softDelete` — distinct from `reactivate`: a deleted tenant is
   * excluded from `findAll` (see its `deletedAt: null` filter) but `findOne`
   * deliberately still finds it, so restoring only clears `deletedAt`;
   * `isActive` stays false so the tenant comes back as "restored but still
   * suspended," not silently live.
   */
  async restore(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data: { deletedAt: null } });
  }

  /**
   * Irreversibly wipes every row this tenant owns, then the tenant itself.
   * Only reachable on a tenant that's already soft-deleted (`softDelete` run
   * first) — this is deliberately the *second* step of a two-step workflow,
   * never a single click from a live church. No model in this schema
   * cascades on Tenant deletion (only `RolePermission`/`UserRole` cascade,
   * on Role/User/Permission), so this deletes every tenant-owned table
   * itself, in an explicit dependency order (children before the parent row
   * they reference) so Postgres's FK constraints never reject a delete.
   *
   * Two real reference cycles exist and are broken by nulling the
   * "downward" side first, before any deletes run: `User.assignedBranchId`/
   * `assignedDepartmentRecordId` point at `Branch`/`DynamicModuleRecord`,
   * which themselves eventually need `User` gone (`createdByUserId` etc.)
   * before they can be deleted; and `Family.headOfFamilyId` points at
   * `Member`, which points back at `Family` via `familyId`. Everything else
   * is a straightforward child-before-parent chain, documented inline by the
   * numbered groups below.
   */
  async hardDelete(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Church not found.' });
    if (!tenant.deletedAt) {
      throw new BadRequestException({
        code: 'TENANT_NOT_SOFT_DELETED',
        message: 'A church must be soft-deleted first (DELETE /platform/tenants/:id) before it can be permanently purged.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Break the two reference cycles up front.
      await tx.user.updateMany({ where: { tenantId: id }, data: { assignedBranchId: null, assignedDepartmentRecordId: null } });
      await tx.family.updateMany({ where: { tenantId: id }, data: { headOfFamilyId: null } });

      // Group 1 — leaves: reference a "core entity" table below, nothing references them.
      await Promise.all([
        tx.dynamicModuleRecordStatusHistory.deleteMany({ where: { tenantId: id } }),
        tx.resourceAssignment.deleteMany({ where: { tenantId: id } }),
        tx.entityMembership.deleteMany({ where: { tenantId: id } }),
        tx.ministryMembership.deleteMany({ where: { tenantId: id } }),
        tx.smallGroupMembership.deleteMany({ where: { tenantId: id } }),
        tx.attendanceRecord.deleteMany({ where: { tenantId: id } }),
        tx.contribution.deleteMany({ where: { tenantId: id } }),
        tx.memberActivity.deleteMany({ where: { tenantId: id } }),
        tx.visitorActivity.deleteMany({ where: { tenantId: id } }),
        tx.eventRegistration.deleteMany({ where: { tenantId: id } }),
        tx.payrollPayment.deleteMany({ where: { tenantId: id } }),
        tx.documentVersion.deleteMany({ where: { tenantId: id } }),
        tx.hierarchyRequirementSubmission.deleteMany({ where: { tenantId: id } }),
        tx.approvalRequest.deleteMany({ where: { tenantId: id } }),
        tx.deadline.deleteMany({ where: { tenantId: id } }),
        tx.menuItem.deleteMany({ where: { tenantId: id } }),
        tx.customFieldValue.deleteMany({ where: { tenantId: id } }),
        tx.customFieldDefinition.deleteMany({ where: { tenantId: id } }),
        tx.refreshToken.deleteMany({ where: { tenantId: id } }),
        tx.passwordResetToken.deleteMany({ where: { tenantId: id } }),
        tx.emailVerificationToken.deleteMany({ where: { tenantId: id } }),
        tx.auditLog.deleteMany({ where: { tenantId: id } }),
        tx.notification.deleteMany({ where: { tenantId: id } }),
        tx.numberingSequence.deleteMany({ where: { tenantId: id } }),
        tx.notificationTemplate.deleteMany({ where: { tenantId: id } }),
        tx.featureToggle.deleteMany({ where: { tenantId: id } }),
        tx.configItem.deleteMany({ where: { tenantId: id } }),
        tx.hierarchyLevelDefinition.deleteMany({ where: { tenantId: id } }),
      ]);

      // Group 2 — Staff (references Member) and Visitor (references Member/VisitorGroup/Branch/User) before Member.
      await tx.staff.deleteMany({ where: { tenantId: id } });
      await tx.visitor.deleteMany({ where: { tenantId: id } });

      // Group 3 — Member (references Branch/Family), then VisitorGroup, then Family.
      await tx.member.deleteMany({ where: { tenantId: id } });
      await tx.visitorGroup.deleteMany({ where: { tenantId: id } });
      await tx.family.deleteMany({ where: { tenantId: id } });

      // Group 4 — other Branch-optional entities.
      await Promise.all([
        tx.ministry.deleteMany({ where: { tenantId: id } }),
        tx.event.deleteMany({ where: { tenantId: id } }),
        tx.asset.deleteMany({ where: { tenantId: id } }),
        tx.document.deleteMany({ where: { tenantId: id } }),
        tx.smallGroup.deleteMany({ where: { tenantId: id } }),
      ]);

      // Group 5 — DynamicModuleRecord (references DynamicModuleDefinition/Branch/User), then User, then Branch.
      await tx.dynamicModuleRecord.deleteMany({ where: { tenantId: id } });
      await tx.user.deleteMany({ where: { tenantId: id } });
      await tx.branch.deleteMany({ where: { tenantId: id } });

      // Group 6 — DynamicModuleDefinition/HierarchyRequirement (reference ApprovalWorkflow), then ApprovalWorkflow (ApprovalStep cascades).
      await tx.dynamicModuleDefinition.deleteMany({ where: { tenantId: id } });
      await tx.hierarchyRequirement.deleteMany({ where: { tenantId: id } });
      await tx.approvalWorkflow.deleteMany({ where: { tenantId: id } });

      // Group 7 — Role (UserRole/RolePermission already cascaded away above), then Tenant itself.
      await tx.role.deleteMany({ where: { tenantId: id } });
      await tx.tenant.delete({ where: { id } });
    });

    return { purged: true };
  }
}
