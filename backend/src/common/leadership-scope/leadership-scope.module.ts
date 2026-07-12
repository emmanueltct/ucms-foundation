import { Module } from '@nestjs/common';
import { LeadershipScopeService } from './leadership-scope.service';

@Module({
  providers: [LeadershipScopeService],
  exports: [LeadershipScopeService],
})
export class LeadershipScopeModule {}
