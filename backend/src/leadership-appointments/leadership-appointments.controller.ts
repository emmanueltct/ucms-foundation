import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { LeadershipAppointmentsService } from './leadership-appointments.service';
import { CreateLeadershipAppointmentDto } from './dto/create-leadership-appointment.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('leadership-appointments')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('leadership-appointments')
export class LeadershipAppointmentsController {
  constructor(private readonly service: LeadershipAppointmentsService) {}

  @ApiOperation({ summary: 'Appoint a user as leader of an organizational unit or custom entity' })
  @Permissions('leadershipappointment.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateLeadershipAppointmentDto) {
    return ok(await this.service.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List leadership appointments for one target entity (e.g. a branch\'s Assigned Administrator)' })
  @ApiQuery({ name: 'targetEntityType', required: true })
  @ApiQuery({ name: 'targetEntityId', required: true })
  @Permissions('leadershipappointment.read')
  @Get()
  async findForTarget(
    @CurrentTenantId() tenantId: string,
    @Query('targetEntityType') targetEntityType: string,
    @Query('targetEntityId') targetEntityId: string,
  ) {
    return ok(await this.service.findForTarget(tenantId, targetEntityType, targetEntityId));
  }

  @ApiOperation({ summary: 'Every leadership appointment the calling user currently holds' })
  @Get('mine')
  async findMine(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return ok(await this.service.findMine(tenantId, user.userId));
  }

  @ApiOperation({ summary: 'Revoke a leadership appointment' })
  @Permissions('leadershipappointment.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.service.remove(tenantId, id));
  }
}
