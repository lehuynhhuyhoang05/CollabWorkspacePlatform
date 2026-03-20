import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block } from './entities/block.entity';
import { BlocksService } from './blocks.service';
import { BlocksController } from './blocks.controller';
import { PagesModule } from '../pages/pages.module';

@Module({
  imports: [TypeOrmModule.forFeature([Block]), PagesModule],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
