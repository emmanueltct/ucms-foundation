import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The permission catalog is global and platform-versioned (see FR-3.1 /
 * business-analysis.md). Tenants can only read it and attach codes to their
 * own roles; only platform migrations add new codes as new modules ship.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(module?: string) {
    return this.prisma.permission.findMany({
      where: module ? { module } : undefined,
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
  }

  async findModules() {
    const rows = await this.prisma.permission.findMany({ distinct: ['module'], select: { module: true } });
    return rows.map((r) => r.module);
  }
}
