import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchesService } from '../branches/branches.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

/**
 * Admin-configured navigation (requirement: Dynamic Menu Builder). Additive
 * to the frontend's static default nav — see MenuItem's schema comment.
 */
@Injectable()
export class MenuItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchesService: BranchesService,
  ) {}

  async create(tenantId: string, dto: CreateMenuItemDto) {
    return this.prisma.menuItem.create({
      data: {
        tenantId,
        label: dto.label,
        icon: dto.icon,
        sortOrder: dto.sortOrder ?? 0,
        parentMenuItemId: dto.parentMenuItemId,
        targetType: dto.targetType,
        targetKey: dto.targetKey,
        visibleToRoleNames: dto.visibleToRoleNames ?? [],
        visibleToBranchId: dto.visibleToBranchId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.menuItem.findMany({ where: { tenantId }, orderBy: [{ sortOrder: 'asc' }] });
  }

  async findOne(tenantId: string, id: string) {
    const item = await this.prisma.menuItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException({ code: 'MENU_ITEM_NOT_FOUND', message: 'Menu item not found.' });
    return item;
  }

  async update(tenantId: string, id: string, dto: UpdateMenuItemDto) {
    await this.findOne(tenantId, id);
    return this.prisma.menuItem.update({
      where: { id },
      data: {
        label: dto.label,
        icon: dto.icon,
        sortOrder: dto.sortOrder,
        parentMenuItemId: dto.parentMenuItemId,
        targetType: dto.targetType,
        targetKey: dto.targetKey,
        visibleToRoleNames: dto.visibleToRoleNames,
        visibleToBranchId: dto.visibleToBranchId,
        isActive: dto.isActive,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.menuItem.delete({ where: { id } });
    return { id };
  }

  /**
   * Filters the active menu tree down to what this specific user should
   * see — role-gated items require one matching role; branch-gated items
   * require the user's own assigned branch to be at-or-under the
   * configured branch. A user with no `assignedBranchId` (church-wide, the
   * default) sees every branch-gated item, mirroring
   * `BranchScopeService.resolveVisibleBranchIds`'s "null = unrestricted"
   * convention for data roll-up.
   */
  async forCurrentUser(tenantId: string, user: AuthenticatedUser) {
    const items = await this.prisma.menuItem.findMany({ where: { tenantId, isActive: true }, orderBy: [{ sortOrder: 'asc' }] });
    if (user.isPlatformAdmin) return items;

    const dbUser = await this.prisma.user.findFirst({ where: { id: user.userId, tenantId }, select: { assignedBranchId: true } });
    const userBranchId = dbUser?.assignedBranchId ?? null;

    const result: typeof items = [];
    for (const item of items) {
      if (item.visibleToRoleNames.length > 0 && !item.visibleToRoleNames.some((r) => user.roles.includes(r))) continue;

      if (item.visibleToBranchId && userBranchId) {
        const descendants = await this.branchesService.findDescendants(tenantId, item.visibleToBranchId);
        const allowed = new Set([item.visibleToBranchId, ...descendants.map((b) => b.id)]);
        if (!allowed.has(userBranchId)) continue;
      }

      result.push(item);
    }
    return result;
  }
}
