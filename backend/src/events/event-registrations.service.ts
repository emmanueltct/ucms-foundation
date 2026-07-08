import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventRegistration } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';
import { UpdateEventRegistrationDto } from './dto/update-event-registration.dto';
import { EventRegistrationQueryDto } from './dto/event-registration-query.dto';

/**
 * Event registrations — a named Member, or a walk-in guest captured by
 * name/contact. See docs/events/business-analysis.md for the capacity and
 * guest-vs-member rules.
 */
@Injectable()
export class EventRegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateEventRegistrationDto): Promise<EventRegistration> {
    const event = await this.assertEventExists(tenantId, dto.eventId);

    if (dto.memberId) {
      await this.assertMemberExists(tenantId, dto.memberId);
      await this.assertNotAlreadyRegistered(tenantId, dto.eventId, dto.memberId);
    } else if (!dto.guestName) {
      throw new BadRequestException({
        code: 'EVENT_REGISTRATION_NAME_REQUIRED',
        message: 'Provide either memberId or guestName to identify the registrant.',
      });
    }

    if (event.capacity !== null) {
      const activeCount = await this.prisma.eventRegistration.count({
        where: { tenantId, eventId: dto.eventId, status: { not: 'cancelled' } },
      });
      if (activeCount >= event.capacity) {
        throw new ConflictException({ code: 'EVENT_FULL', message: 'This event has reached its registration capacity.' });
      }
    }

    return this.prisma.eventRegistration.create({
      data: {
        tenantId,
        eventId: dto.eventId,
        memberId: dto.memberId ?? null,
        guestName: dto.memberId ? undefined : dto.guestName,
        guestContact: dto.guestContact,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: EventRegistrationQueryDto) {
    const where = {
      tenantId,
      ...(query.eventId ? { eventId: query.eventId } : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.eventRegistration.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { createdAt: 'desc' },
      }),
      this.prisma.eventRegistration.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(tenantId: string, id: string): Promise<EventRegistration> {
    const registration = await this.prisma.eventRegistration.findFirst({ where: { id, tenantId } });
    if (!registration) {
      throw new NotFoundException({ code: 'EVENT_REGISTRATION_NOT_FOUND', message: 'Event registration not found.' });
    }
    return registration;
  }

  async update(tenantId: string, id: string, dto: UpdateEventRegistrationDto): Promise<EventRegistration> {
    await this.findOne(tenantId, id);
    return this.prisma.eventRegistration.update({ where: { id }, data: { status: dto.status, notes: dto.notes } });
  }

  /** Cancels the registration — the row stays for attendance-history purposes, never hard-deleted. */
  async cancel(tenantId: string, id: string): Promise<EventRegistration> {
    await this.findOne(tenantId, id);
    return this.prisma.eventRegistration.update({ where: { id }, data: { status: 'cancelled' } });
  }

  private async assertEventExists(tenantId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, tenantId, deletedAt: null } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    return event;
  }

  private async assertMemberExists(tenantId: string, memberId: string): Promise<void> {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId, deletedAt: null } });
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
  }

  private async assertNotAlreadyRegistered(tenantId: string, eventId: string, memberId: string): Promise<void> {
    const existing = await this.prisma.eventRegistration.findFirst({ where: { tenantId, eventId, memberId } });
    if (existing) {
      throw new ConflictException({
        code: 'EVENT_REGISTRATION_ALREADY_EXISTS',
        message: 'This member is already registered for this event.',
      });
    }
  }
}
