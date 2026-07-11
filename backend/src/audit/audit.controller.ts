import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';

@ApiTags('audit')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @ApiOperation({ summary: 'List audit log entries (paginated, filterable by action/entityType/userId)' })
  @Permissions('audit.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: AuditLogQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.auditService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }
}
