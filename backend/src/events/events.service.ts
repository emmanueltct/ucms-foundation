import { Injectable, NotFoundException } from '@nestjs/common';
import { Event } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { resolveBranchFilterIncludingChurchWide } from '../common/branch-scope/branch-visibility.util';

/**
 * Events — see docs/events/business-analysis.md. Flat like Ministry (no
 * self-reference), optionally scoped to one Branch or church-wide.
 */
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateEventDto): Promise<Event> {
    if (dto.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }

    return this.prisma.event.create({
      data: {
        tenantId,
        branchId: dto.branchId ?? null,
        name: dto.name,
        eventType: dto.eventType,
        description: dto.description,
        location: dto.location,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        capacity: dto.capacity,
      },
    });
  }

  async findAll(tenantId: string, query: EventQueryDto, visibleBranchIds: string[] | null = null) {
    const where = {
      tenantId,
      deletedAt: null,
      ...resolveBranchFilterIncludingChurchWide(query.branchId, visibleBranchIds),
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            startsAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { startsAt: 'asc' },
      }),
      this.prisma.event.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<Event> {
    const event = await this.prisma.event.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    return event;
  }

  async update(tenantId: string, id: string, dto: UpdateEventDto): Promise<Event> {
    const existing = await this.findOne(tenantId, id);

    if (dto.branchId && dto.branchId !== existing.branchId) {
      await this.assertBranchExists(tenantId, dto.branchId);
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        name: dto.name,
        eventType: dto.eventType,
        description: dto.description,
        location: dto.location,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        capacity: dto.capacity,
      },
    });
  }

  /** Soft-deletes the event and cancels every non-cancelled registration, preserving registration history. */
  async softDelete(tenantId: string, id: string): Promise<Event> {
    await this.findOne(tenantId, id);
    await this.prisma.eventRegistration.updateMany({
      where: { tenantId, eventId: id, status: { not: 'cancelled' } },
      data: { status: 'cancelled' },
    });
    return this.prisma.event.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  private async assertBranchExists(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId, deletedAt: null } });
    if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });
  }
}
