import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module';
import { UsersModule } from '../users/users.module';
import { ReportsModule } from '../reports/reports.module';
import { DynamicModulesModule } from '../dynamic-modules/dynamic-modules.module';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantProfileService } from './tenant-profile.service';
import { TenantProfileController } from './tenant-profile.controller';
import { PlatformTenantAdminController } from './platform-tenant-admin.controller';

@Module({
  imports: [BranchesModule, UsersModule, ReportsModule, DynamicModulesModule],
  controllers: [TenantsController, TenantProfileController, PlatformTenantAdminController],
  providers: [TenantsService, TenantProfileService],
  exports: [TenantsService],
})
export class TenantsModule {}
