import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { EventRegistrationsService } from './event-registrations.service';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';
import { UpdateEventRegistrationDto } from './dto/update-event-registration.dto';
import { EventRegistrationQueryDto } from './dto/event-registration-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('event-registrations')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('event-registrations')
export class EventRegistrationsController {
  constructor(private readonly registrationsService: EventRegistrationsService) {}

  @ApiOperation({ summary: 'Register a member (or a walk-in guest) for an event' })
  @Permissions('event.registration.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateEventRegistrationDto) {
    return ok(await this.registrationsService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List registrations (paginated, filterable by event/member/status)' })
  @Permissions('event.registration.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: EventRegistrationQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.registrationsService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one registration' })
  @Permissions('event.registration.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.registrationsService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update a registration\'s status (e.g. mark attended) or notes' })
  @Permissions('event.registration.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateEventRegistrationDto) {
    return ok(await this.registrationsService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Cancel a registration (keeps the row for history)' })
  @Permissions('event.registration.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.registrationsService.cancel(tenantId, id));
  }
}
