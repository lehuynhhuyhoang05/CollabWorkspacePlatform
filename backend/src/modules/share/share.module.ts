import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { PageShare } from './entities/page-share.entity';
import { Page } from '../pages/entities/page.entity';
import { PagesModule } from '../pages/pages.module';

@Module({
  imports: [TypeOrmModule.forFeature([PageShare, Page]), PagesModule],
  controllers: [ShareController],
  providers: [ShareService],
})
export class ShareModule {}
