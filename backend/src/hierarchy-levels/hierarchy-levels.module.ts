import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HierarchyLevelsService } from './hierarchy-levels.service';
import { HierarchyLevelsController } from './hierarchy-levels.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HierarchyLevelsController],
  providers: [HierarchyLevelsService],
  exports: [HierarchyLevelsService],
})
export class HierarchyLevelsModule {}
