import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { StorageModule } from '../storage/storage.module';
import { BranchScopeModule } from '../common/branch-scope/branch-scope.module';

@Module({
  imports: [StorageModule, BranchScopeModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
