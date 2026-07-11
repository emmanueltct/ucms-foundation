import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrashService } from './trash.service';
import { TrashController } from './trash.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TrashController],
  providers: [TrashService],
})
export class TrashModule {}
