import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditModule } from '../audit/audit.module';
import { LeadershipScopeModule } from '../common/leadership-scope/leadership-scope.module';

@Module({
  imports: [AuditModule, LeadershipScopeModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
