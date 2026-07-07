import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { UpdateContributionDto } from './dto/update-contribution.dto';
import { VoidContributionDto } from './dto/void-contribution.dto';
import { ContributionQueryDto } from './dto/contribution-query.dto';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

@ApiTags('finance')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('contributions')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @ApiOperation({ summary: 'Record a contribution' })
  @Permissions('finance.contribution.create')
  @Post()
  async create(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContributionDto) {
    return ok(await this.financeService.create(tenantId, user?.userId, dto));
  }

  @ApiOperation({ summary: 'List contributions (paginated, filterable by branch/member/type/method/date range)' })
  @Permissions('finance.contribution.read')
  @Get()
  async findAll(@CurrentTenantId() tenantId: string, @Query() query: ContributionQueryDto) {
    const { items, total, page, pageSize, totalPages } = await this.financeService.findAll(tenantId, query);
    return ok(items, { total, page, pageSize, totalPages });
  }

  @ApiOperation({ summary: 'Totals grouped by contribution type, for the same filters as the list endpoint' })
  @Permissions('finance.contribution.read')
  @Get('summary')
  async summary(@CurrentTenantId() tenantId: string, @Query() query: ContributionQueryDto) {
    return ok(await this.financeService.summary(tenantId, query));
  }

  @ApiOperation({ summary: 'Get one contribution (voided or not)' })
  @Permissions('finance.contribution.read')
  @Get(':id')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return ok(await this.financeService.findOne(tenantId, id));
  }

  @ApiOperation({ summary: "Update a contribution's notes/receipt number only" })
  @Permissions('finance.contribution.update')
  @Patch(':id')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateContributionDto) {
    return ok(await this.financeService.update(tenantId, id, dto));
  }

  @ApiOperation({ summary: 'Void a contribution (requires a reason); financial records are never deleted' })
  @Permissions('finance.contribution.void')
  @Patch(':id/void')
  async void(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VoidContributionDto,
  ) {
    return ok(await this.financeService.void(tenantId, id, user?.userId, dto.voidReason));
  }
}
