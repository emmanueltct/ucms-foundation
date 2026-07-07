import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantProfileService } from './tenant-profile.service';
import { TenantProfileController } from './tenant-profile.controller';

@Module({
  imports: [BranchesModule],
  controllers: [TenantsController, TenantProfileController],
  providers: [TenantsService, TenantProfileService],
  exports: [TenantsService],
})
export class TenantsModule {}
