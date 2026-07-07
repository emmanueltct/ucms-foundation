import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('attendance')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('attendance-records')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @ApiOperation({ summary: 'Record attendance — an individual check-in (memberId) or an anonymous head-count' })
  @Permissions('attendance.record.create')
  @Post()
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAttendanceRecordDto,
  ) {
    return ok(await this.attendanceService.create(tenantId, user?.userId, dto));
  }

  @ApiOperation({ summary: 'List attendance records (paginated, filterable by branch/member/service type/date range)' })
  @Permissions('attendance.record.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: AttendanceQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.attendanceService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Totals grouped by service type, for the same filters as the list endpoint' })
  @Permissions('attendance.record.read')
  @Get('summary')
  async summary(@CurrentTenantId() tenantId: string, @Query() query: AttendanceQueryDto) {
    return ok(await this.attendanceService.summary(tenantId, query));
  }

  @ApiOperation({ summary: 'Get one attendance record' })
  @Permissions('attendance.record.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.attendanceService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Correct an attendance record' })
  @Permissions('attendance.record.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateAttendanceRecordDto) {
    return ok(await this.attendanceService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Soft-delete an attendance record' })
  @Permissions('attendance.record.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.attendanceService.softDelete(tenantId, id));
  }
}
