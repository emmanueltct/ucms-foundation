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
import { DocumentsModule } from './documents/documents.module';
import { SmallGroupsModule } from './small-groups/small-groups.module';

import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RequiresAuditReasonGuard } from './common/guards/requires-audit-reason.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditModule } from './audit/audit.module';
import { ApprovalWorkflowsModule } from './approval-workflows/approval-workflows.module';
import { DeadlinesModule } from './deadlines/deadlines.module';
import { BranchScopeModule } from './common/branch-scope/branch-scope.module';
import { HierarchyRequirementsModule } from './hierarchy-requirements/hierarchy-requirements.module';
import { DynamicModulesModule } from './dynamic-modules/dynamic-modules.module';
import { EntityMembershipsModule } from './entity-memberships/entity-memberships.module';
import { PlatformAuthModule } from './platform-auth/platform-auth.module';
import { MenuItemsModule } from './menu-items/menu-items.module';
import { NotificationTemplatesModule } from './notification-templates/notification-templates.module';
import { NumberingSequencesModule } from './numbering-sequences/numbering-sequences.module';
import { TrashModule } from './trash/trash.module';
import { HierarchyLevelsModule } from './hierarchy-levels/hierarchy-levels.module';
import { ResourceAssignmentsModule } from './resource-assignments/resource-assignments.module';

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
    DocumentsModule,
    SmallGroupsModule,
    AuditModule,
    ApprovalWorkflowsModule,
    DeadlinesModule,
    BranchScopeModule,
    HierarchyRequirementsModule,
    DynamicModulesModule,
    EntityMembershipsModule,
    PlatformAuthModule,
    MenuItemsModule,
    NotificationTemplatesModule,
    NumberingSequencesModule,
    TrashModule,
    HierarchyLevelsModule,
    ResourceAssignmentsModule,
  ],
  providers: [
    // Order matters: JWT auth runs first, then RBAC, then fine-grained PBAC,
    // then the mandatory-reason check (which only matters once we already
    // know the caller is authorized to attempt the action at all).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: RequiresAuditReasonGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // RouteInfo needs an explicit `version` here — `enableVersioning({ defaultVersion: '1' })`
    // in main.ts puts every route under /v1 implicitly, and MiddlewareConsumer#exclude only
    // matches a route if its RouteInfo's version lines up; without it, none of these excludes
    // ever matched and every "public"/cross-tenant auth route below 400'd with TENANT_NOT_RESOLVED.
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET, version: '1' },
        // platform-admin routes aren't tenant-scoped. Both the bare collection route
        // (GET/POST /platform/tenants) and its sub-paths (/platform/tenants/:id, ...)
        // need their own RouteInfo — a single trailing 'platform/tenants*' silently
        // failed to match the bare route at all (path-to-regexp needs a '/' before a
        // wildcard segment), which is why tenant creation 400'd with TENANT_NOT_RESOLVED.
        // Second bug found later (live-tested only now, via the Phase 1 tenant detail
        // page): a bare trailing '*' is NOT a wildcard token in this path-to-regexp
        // version — it compiles to a LITERAL asterisk character, so
        // 'platform/tenants/*' never matched ANY real sub-path (confirmed by testing
        // path-to-regexp's parse()/tokensToRegExp() directly) — every :id-suffixed
        // platform/tenants route (findOne/update/deactivate/reactivate/restore/remove,
        // plus the new users/health sub-routes) was silently 400ing with
        // TENANT_NOT_RESOLVED the whole time. '(.*)' is the correct multi-segment
        // wildcard in this version.
        { path: 'platform/tenants', method: RequestMethod.ALL, version: '1' },
        { path: 'platform/tenants/(.*)', method: RequestMethod.ALL, version: '1' },
        { path: 'platform/auth/login', method: RequestMethod.POST, version: '1' }, // platform admin login has no tenant at all
        // Password reset is deliberately cross-tenant — the person resetting a
        // password may not remember which church workspace they're in; the
        // token itself (not a header) resolves the tenant. See AuthService.
        { path: 'auth/forgot-password', method: RequestMethod.POST, version: '1' },
        { path: 'auth/reset-password', method: RequestMethod.POST, version: '1' },
        // Same reasoning as password reset — the verification token itself
        // resolves the tenant, not a header.
        { path: 'auth/verify-email', method: RequestMethod.POST, version: '1' },
        // Login's X-Tenant-Slug header is optional (see AuthService.login) —
        // it resolves the tenant itself when a slug is given, and routes by
        // email+password across every tenant when it's not.
        { path: 'auth/login', method: RequestMethod.POST, version: '1' },
      )
      .forRoutes('*');
  }
}
