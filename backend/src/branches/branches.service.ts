import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Branch } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

export interface BranchTreeNode extends Branch {
  children: BranchTreeNode[];
}

/**
 * Church & Hierarchy Management — the organizational tree every later
 * module (Member Management, Finance, ...) attaches records to. Modeled as
 * a single self-referencing `Branch` tree rather than fixed levels
 * (diocese/parish/etc.) so it fits denominations with very different
 * shapes; see the model comment in schema.prisma.
 */
@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateBranchDto): Promise<Branch> {
    if (dto.parentBranchId) {
      await this.findOne(tenantId, dto.parentBranchId);
    }

    if (dto.isHeadquarters) {
      await this.clearExistingHeadquarters(tenantId);
    }

    return this.prisma.branch.create({
      data: {
        tenantId,
        name: dto.name,
        parentBranchId: dto.parentBranchId ?? null,
        branchType: dto.branchType,
        code: dto.code,
        address: dto.address,
        isHeadquarters: dto.isHeadquarters ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /** Flat list, ordered for display — callers that need the tree should use `findTree`. */
  async findAll(tenantId: string, includeInactive = false): Promise<Branch[]> {
    return this.prisma.branch.findMany({
      where: { tenantId, deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string): Promise<Branch> {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
    return branch;
  }

  /** Assembles the flat list into a nested tree in memory — fine at church-hierarchy scale (tens/hundreds of branches). */
  async findTree(tenantId: string, includeInactive = false): Promise<BranchTreeNode[]> {
    const branches = await this.findAll(tenantId, includeInactive);
    const byId = new Map<string, BranchTreeNode>(branches.map((b) => [b.id, { ...b, children: [] }]));
    const roots: BranchTreeNode[] = [];

    for (const branch of byId.values()) {
      if (branch.parentBranchId && byId.has(branch.parentBranchId)) {
        byId.get(branch.parentBranchId)!.children.push(branch);
      } else {
        roots.push(branch);
      }
    }
    return roots;
  }

  /** Ancestor chain from immediate parent up to the root. */
  async findAncestors(tenantId: string, id: string): Promise<Branch[]> {
    const branch = await this.findOne(tenantId, id);
    const ancestors: Branch[] = [];
    let currentParentId = branch.parentBranchId;
    const visited = new Set<string>([id]);

    while (currentParentId) {
      if (visited.has(currentParentId)) break; // defensive: never trust data blindly, even though `move` prevents cycles
      visited.add(currentParentId);
      const parent = await this.prisma.branch.findFirst({ where: { id: currentParentId, tenantId, deletedAt: null } });
      if (!parent) break;
      ancestors.push(parent);
      currentParentId = parent.parentBranchId;
    }
    return ancestors;
  }

  /** All descendants (children, grandchildren, ...) of a branch, flattened. */
  async findDescendants(tenantId: string, id: string): Promise<Branch[]> {
    await this.findOne(tenantId, id);
    const all = await this.prisma.branch.findMany({ where: { tenantId, deletedAt: null } });
    const childrenByParent = new Map<string, Branch[]>();
    for (const branch of all) {
      if (!branch.parentBranchId) continue;
      const siblings = childrenByParent.get(branch.parentBranchId) ?? [];
      siblings.push(branch);
      childrenByParent.set(branch.parentBranchId, siblings);
    }

    const descendants: Branch[] = [];
    const queue = [...(childrenByParent.get(id) ?? [])];
    while (queue.length) {
      const next = queue.shift()!;
      descendants.push(next);
      queue.push(...(childrenByParent.get(next.id) ?? []));
    }
    return descendants;
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto): Promise<Branch> {
    await this.findOne(tenantId, id);

    if (dto.isHeadquarters) {
      await this.clearExistingHeadquarters(tenantId, id);
    }

    return this.prisma.branch.update({
      where: { id },
      data: {
        name: dto.name,
        branchType: dto.branchType,
        code: dto.code,
        address: dto.address,
        isHeadquarters: dto.isHeadquarters,
        sortOrder: dto.sortOrder,
      },
    });
  }

  /** Re-parents a branch, rejecting moves that would create a cycle (a branch becoming its own descendant's child). */
  async move(tenantId: string, id: string, newParentBranchId: string | null | undefined): Promise<Branch> {
    await this.findOne(tenantId, id);

    if (newParentBranchId) {
      if (newParentBranchId === id) {
        throw new BadRequestException({ code: 'BRANCH_CIRCULAR_REFERENCE', message: 'A branch cannot be its own parent.' });
      }
      await this.findOne(tenantId, newParentBranchId);

      const targetAncestors = await this.findAncestors(tenantId, newParentBranchId);
      if (targetAncestors.some((ancestor) => ancestor.id === id)) {
        throw new BadRequestException({
          code: 'BRANCH_CIRCULAR_REFERENCE',
          message: 'Cannot move a branch under one of its own descendants.',
        });
      }
    }

    return this.prisma.branch.update({ where: { id }, data: { parentBranchId: newParentBranchId ?? null } });
  }

  /** Soft-deactivates this branch and every descendant, so historical records (members, contributions) keep a valid reference. */
  async deactivate(tenantId: string, id: string): Promise<Branch> {
    const branch = await this.findOne(tenantId, id);
    const descendants = await this.findDescendants(tenantId, id);
    const idsToDeactivate = [id, ...descendants.map((d) => d.id)];

    await this.prisma.branch.updateMany({ where: { id: { in: idsToDeactivate }, tenantId }, data: { isActive: false } });
    return { ...branch, isActive: false };
  }

  /** Reactivates only this branch — descendants that were independently deactivated stay as they were. */
  async reactivate(tenantId: string, id: string): Promise<Branch> {
    await this.findOne(tenantId, id);
    return this.prisma.branch.update({ where: { id }, data: { isActive: true } });
  }

  private async clearExistingHeadquarters(tenantId: string, exceptId?: string): Promise<void> {
    await this.prisma.branch.updateMany({
      where: { tenantId, isHeadquarters: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isHeadquarters: false },
    });
  }
}
