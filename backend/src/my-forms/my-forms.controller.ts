import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { MyFormsService } from './my-forms.service';
import { CurrentTenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ok } from '../common/interfaces/api-response.interface';
import { AuthenticatedUser } from '../common/interfaces/request-context.interface';

/** No static `@Permissions()` — every authenticated user may see their own assigned forms; eligibility itself is the access control (§13/§14). */
@ApiTags('my-forms')
@ApiBearerAuth()
@ApiSecurity('tenant-slug')
@Controller('my-forms')
export class MyFormsController {
  constructor(private readonly service: MyFormsService) {}

  @ApiOperation({ summary: 'Every form/report currently assigned to me, with my own submission(s) against each, if any' })
  @Get()
  async list(@CurrentTenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return ok(await this.service.list(tenantId, user.userId));
  }
}
