import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ConfigEngineModule } from './config-engine/config.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { BranchesModule } from './branches/branches.module';
import { FamiliesModule } from './families/families.module';
import { MembersModule } from './members/members.module';
import { FinanceModule } from './finance/finance.module';
import { AttendanceModule } from './attendance/attendance.module';
import { MinistriesModule } from './ministries/ministries.module';
import { CommunicationModule } from './communication/communication.module';
import { EventsModule } from './events/events.module';
import { HrModule } from './hr/hr.module';
import { ReportsModule } from './reports/reports.module';
import { AssetsModule } from './assets/assets.module';
import { VisitorsModule } from './visitors/visitors.module';

import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    NestConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), // sane platform-wide default; auth endpoints tighten further
    PrismaModule,
    QueueModule,
    StorageModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    ConfigEngineModule,
    CustomFieldsModule,
    BranchesModule,
    FamiliesModule,
    MembersModule,
    FinanceModule,
    AttendanceModule,
    MinistriesModule,
    CommunicationModule,
    EventsModule,
    HrModule,
    ReportsModule,
    AssetsModule,
    VisitorsModule,
  ],
  providers: [
    // Order matters: JWT auth runs first, then RBAC, then fine-grained PBAC.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'platform/tenants*', method: RequestMethod.ALL }, // platform-admin routes aren't tenant-scoped
      )
      .forRoutes('*');
  }
}
