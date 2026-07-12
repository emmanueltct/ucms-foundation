import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadershipAppointmentDto } from './dto/create-leadership-appointment.dto';

@Injectable()
export class LeadershipAppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateLeadershipAppointmentDto) {
    const existing = await this.prisma.leadershipAppointment.findUnique({
      where: {
        tenantId_targetEntityType_targetEntityId_userId: {
          tenantId,
          targetEntityType: dto.targetEntityType,
          targetEntityId: dto.targetEntityId,
          userId: dto.userId,
        },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'LEADERSHIP_APPOINTMENT_ALREADY_EXISTS',
        message: 'This user already holds an appointment over this target.',
      });
    }
    return this.prisma.leadershipAppointment.create({
      data: { tenantId, ...dto },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async findForTarget(tenantId: string, targetEntityType: string, targetEntityId: string) {
    return this.prisma.leadershipAppointment.findMany({
      where: { tenantId, targetEntityType, targetEntityId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  /** Every appointment the calling user holds — powers "which entities do I administer" (e.g. a Branch Administrator's user-registration form). */
  async findMine(tenantId: string, userId: string) {
    return this.prisma.leadershipAppointment.findMany({ where: { tenantId, userId } });
  }

  async remove(tenantId: string, id: string): Promise<{ id: string }> {
    const existing = await this.prisma.leadershipAppointment.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException({ code: 'LEADERSHIP_APPOINTMENT_NOT_FOUND', message: 'Leadership appointment not found.' });
    }
    await this.prisma.leadershipAppointment.delete({ where: { id } });
    return { id };
  }
}
