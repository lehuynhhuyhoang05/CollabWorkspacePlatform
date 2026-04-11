import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from '../pages/entities/page.entity';
import { Block } from '../blocks/entities/block.entity';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [TypeOrmModule.forFeature([Page, Block]), WorkspacesModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
