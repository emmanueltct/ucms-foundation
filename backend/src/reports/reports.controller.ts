import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { sendExportFile } from '../common/exports/export.util';

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

  @ApiOperation({ summary: 'Download the finance summary as CSV/XLSX/PDF (?format=)' })
  @Permissions('reports.view')
  @Get('finance-summary/export')
  async exportFinanceSummary(@CurrentTenantId() tenantId: string, @Query() query: ExportQueryDto, @Res() res: Response) {
    const tables = await this.reportsService.exportFinanceSummary(tenantId, query);
    await sendExportFile(res, query.format ?? 'csv', 'finance-summary', tables, 'Finance Summary');
  }

  @ApiOperation({ summary: 'Attendance totals by month and by service type' })
  @Permissions('reports.view')
  @Get('attendance-trends')
  async attendanceTrends(@CurrentTenantId() tenantId: string, @Query() query: ReportQueryDto) {
    return ok(await this.reportsService.attendanceTrends(tenantId, query));
  }

  @ApiOperation({ summary: 'Download attendance trends as CSV/XLSX/PDF (?format=)' })
  @Permissions('reports.view')
  @Get('attendance-trends/export')
  async exportAttendanceTrends(@CurrentTenantId() tenantId: string, @Query() query: ExportQueryDto, @Res() res: Response) {
    const tables = await this.reportsService.exportAttendanceTrends(tenantId, query);
    await sendExportFile(res, query.format ?? 'csv', 'attendance-trends', tables, 'Attendance Trends');
  }

  @ApiOperation({ summary: 'New members by month plus cumulative active membership' })
  @Permissions('reports.view')
  @Get('membership-growth')
  async membershipGrowth(@CurrentTenantId() tenantId: string, @Query() query: ReportQueryDto) {
    return ok(await this.reportsService.membershipGrowth(tenantId, query));
  }

  @ApiOperation({ summary: 'Download membership growth as CSV/XLSX/PDF (?format=)' })
  @Permissions('reports.view')
  @Get('membership-growth/export')
  async exportMembershipGrowth(@CurrentTenantId() tenantId: string, @Query() query: ExportQueryDto, @Res() res: Response) {
    const tables = await this.reportsService.exportMembershipGrowth(tenantId, query);
    await sendExportFile(res, query.format ?? 'csv', 'membership-growth', tables, 'Membership Growth');
  }

  @ApiOperation({ summary: 'Paid payroll totals by month and by department' })
  @Permissions('reports.view')
  @Get('payroll-summary')
  async payrollSummary(@CurrentTenantId() tenantId: string, @Query() query: ReportQueryDto) {
    return ok(await this.reportsService.payrollSummary(tenantId, query));
  }

  @ApiOperation({ summary: 'Download the payroll summary as CSV/XLSX/PDF (?format=)' })
  @Permissions('reports.view')
  @Get('payroll-summary/export')
  async exportPayrollSummary(@CurrentTenantId() tenantId: string, @Query() query: ExportQueryDto, @Res() res: Response) {
    const tables = await this.reportsService.exportPayrollSummary(tenantId, query);
    await sendExportFile(res, query.format ?? 'csv', 'payroll-summary', tables, 'Payroll Summary');
  }

  @ApiOperation({
    summary:
      "A member's full personal history: ministries, small groups, events, attendance, giving, and logged activities merged into one timeline",
  })
  @Permissions('reports.view')
  @Get('members/:id/activity-history')
  async memberActivityHistory(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.reportsService.memberActivityHistory(tenantId, id));
  }
}
