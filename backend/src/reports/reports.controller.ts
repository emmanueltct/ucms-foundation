import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('reports')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Dashboard KPI tiles: members, active staff, branches, upcoming events, this month giving, 30-day attendance' })
  @Permissions('reports.view')
  @Get('overview')
  async overview(@CurrentTenantId() tenantId: string) {
    return ok(await this.reportsService.overview(tenantId));
  }

  @ApiOperation({ summary: 'Contribution totals by month and by contribution type' })
  @Permissions('reports.view')
  @Get('finance-summary')
  async financeSummary(@CurrentTenantId() tenantId: string, @Query() query: ReportQueryDto) {
    return ok(await this.reportsService.financeSummary(tenantId, query));
  }

  @ApiOperation({ summary: 'Attendance totals by month and by service type' })
  @Permissions('reports.view')
  @Get('attendance-trends')
  async attendanceTrends(@CurrentTenantId() tenantId: string, @Query() query: ReportQueryDto) {
    return ok(await this.reportsService.attendanceTrends(tenantId, query));
  }

  @ApiOperation({ summary: 'New members by month plus cumulative active membership' })
  @Permissions('reports.view')
  @Get('membership-growth')
  async membershipGrowth(@CurrentTenantId() tenantId: string, @Query() query: ReportQueryDto) {
    return ok(await this.reportsService.membershipGrowth(tenantId, query));
  }

  @ApiOperation({ summary: 'Paid payroll totals by month and by department' })
  @Permissions('reports.view')
  @Get('payroll-summary')
  async payrollSummary(@CurrentTenantId() tenantId: string, @Query() query: ReportQueryDto) {
    return ok(await this.reportsService.payrollSummary(tenantId, query));
  }
}
