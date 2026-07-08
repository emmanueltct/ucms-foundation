import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffQueryDto } from './dto/staff-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('staff')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @ApiOperation({ summary: 'Create a staff (HR) record, optionally linked to an existing member' })
  @Permissions('staff.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateStaffDto) {
    return ok(await this.staffService.create(tenantId, dto));
  }

  @ApiOperation({ summary: 'List staff (paginated, searchable, filterable by branch/employment status)' })
  @Permissions('staff.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: StaffQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.staffService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Get one staff record' })
  @Permissions('staff.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.staffService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: 'Update a staff record' })
  @Permissions('staff.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return ok(await this.staffService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Soft-delete a staff record (payroll history stays intact)' })
  @Permissions('staff.delete')
  @Delete(':id')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.staffService.softDelete(tenantId, id));
  }
}
