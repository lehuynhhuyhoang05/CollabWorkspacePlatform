import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from './entities/page.entity';
import { PageVersion } from './entities/page-version.entity';
import { Block } from '../blocks/entities/block.entity';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Page, PageVersion, Block]),
    WorkspacesModule,
  ],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
