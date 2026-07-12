import { Module } from '@nestjs/common';
import { LeadershipAppointmentsService } from './leadership-appointments.service';
import { LeadershipAppointmentsController } from './leadership-appointments.controller';

@Module({
  controllers: [LeadershipAppointmentsController],
  providers: [LeadershipAppointmentsService],
  exports: [LeadershipAppointmentsService],
})
export class LeadershipAppointmentsModule {}
