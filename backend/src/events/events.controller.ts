import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('events')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @ApiOperation({ summary: 'Create an event (church-wide or scoped to a branch)' })
  @Permissions('event.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateEventDto) {
    return ok(await this.eventsService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List events (paginated, filterable by branch/type/date range)' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @Permissions('event.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: EventQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.eventsService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one event' })
  @Permissions('event.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.eventsService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update an event' })
  @Permissions('event.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateEventDto) {
    return ok(await this.eventsService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Soft-delete an event and cancel its registrations' })
  @Permissions('event.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.eventsService.softDelete(tenantId, id));
  }
}
