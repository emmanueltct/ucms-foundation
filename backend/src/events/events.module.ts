import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventRegistrationsService } from './event-registrations.service';
import { EventRegistrationsController } from './event-registrations.controller';

@Module({
  controllers: [EventsController, EventRegistrationsController],
  providers: [EventsService, EventRegistrationsService],
  exports: [EventsService, EventRegistrationsService],
})
export class EventsModule {}
