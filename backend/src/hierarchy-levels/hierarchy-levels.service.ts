import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { HierarchyLevelDefinition } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHierarchyLevelDefinitionDto } from './dto/create-hierarchy-level-definition.dto';
import { UpdateHierarchyLevelDefinitionDto } from './dto/update-hierarchy-level-definition.dto';

/**
 * Optional nesting rules over `Branch.branchType` — see the model comment
 * in schema.prisma. Every tenant starts with zero rows, so this is inert
 * (no validation anywhere) until a tenant deliberately defines rules; see
 * `BranchesService`'s use of `findForType`/rule lookups.
 */
@Injectable()
export class HierarchyLevelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateHierarchyLevelDefinitionDto): Promise<HierarchyLevelDefinition> {
    const existing = await this.prisma.hierarchyLevelDefinition.findUnique({
      where: { tenantId_branchTypeKey: { tenantId, branchTypeKey: dto.branchTypeKey } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'HIERARCHY_LEVEL_KEY_TAKEN',
        message: `A hierarchy level rule for branch type "${dto.branchTypeKey}" already exists.`,
      });
    }
    return this.prisma.hierarchyLevelDefinition.create({
      data: {
        tenantId,
        branchTypeKey: dto.branchTypeKey,
        label: dto.label,
        allowedParentTypeKeys: dto.allowedParentTypeKeys ?? [],
        allowedChildTypeKeys: dto.allowedChildTypeKeys ?? [],
        sortOrder: dto.sortOrder ?? 0,
        color: dto.color,
      },
    });
  }

  async findAll(tenantId: string): Promise<HierarchyLevelDefinition[]> {
    return this.prisma.hierarchyLevelDefinition.findMany({ where: { tenantId }, orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
  }

  async update(tenantId: string, id: string, dto: UpdateHierarchyLevelDefinitionDto): Promise<HierarchyLevelDefinition> {
    await this.findOneOrThrow(tenantId, id);
    return this.prisma.hierarchyLevelDefinition.update({
      where: { id },
      data: {
        label: dto.label,
        allowedParentTypeKeys: dto.allowedParentTypeKeys,
        allowedChildTypeKeys: dto.allowedChildTypeKeys,
        sortOrder: dto.sortOrder,
        color: dto.color,
      },
    });
  }

  async remove(tenantId: string, id: string): Promise<{ id: string }> {
    await this.findOneOrThrow(tenantId, id);
    await this.prisma.hierarchyLevelDefinition.delete({ where: { id } });
    return { id };
  }

  /** Used by `BranchesService` — a type with no rule row is unconstrained, so `null` (not a 404) is the expected "no rule configured" result. */
  async findForType(tenantId: string, branchTypeKey: string): Promise<HierarchyLevelDefinition | null> {
    return this.prisma.hierarchyLevelDefinition.findUnique({ where: { tenantId_branchTypeKey: { tenantId, branchTypeKey } } });
  }

  private async findOneOrThrow(tenantId: string, id: string): Promise<HierarchyLevelDefinition> {
    const level = await this.prisma.hierarchyLevelDefinition.findFirst({ where: { id, tenantId } });
    if (!level) throw new NotFoundException({ code: 'HIERARCHY_LEVEL_NOT_FOUND', message: 'Hierarchy level rule not found.' });
    return level;
  }
}
