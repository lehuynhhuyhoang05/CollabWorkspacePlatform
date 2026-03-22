import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { PageShare } from './entities/page-share.entity';
import { CreateShareDto, SharePermission } from './dto/create-share.dto';
import { PagesService } from '../pages/pages.service';
import { Page } from '../pages/entities/page.entity';

@Injectable()
export class ShareService {
  constructor(
    @InjectRepository(PageShare)
    private readonly shareRepository: Repository<PageShare>,
    @InjectRepository(Page)
    private readonly pagesRepository: Repository<Page>,
    private readonly pagesService: PagesService,
  ) {}

  async create(pageId: string, userId: string, dto: CreateShareDto) {
    await this.pagesService.assertCanEditPage(pageId, userId);

    const token = await this.generateUniqueToken();
    const permission = dto.permission ?? SharePermission.VIEW;

    const share = this.shareRepository.create({
      pageId,
      userId,
      token,
      permission,
    });

    const saved = await this.shareRepository.save(share);

    return {
      token: saved.token,
      permission: saved.permission,
      createdAt: saved.createdAt,
    };
  }

  async resolve(token: string) {
    const share = await this.shareRepository.findOne({ where: { token } });
    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    const page = await this.pagesRepository.findOne({
      where: { id: share.pageId, isDeleted: false },
      relations: ['blocks'],
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    page.blocks.sort((a, b) => a.sortOrder - b.sortOrder);

    return {
      permission: share.permission,
      page: {
        id: page.id,
        title: page.title,
        icon: page.icon,
        coverUrl: page.coverUrl,
        updatedAt: page.updatedAt,
        blocks: page.blocks,
      },
    };
  }

  private async generateUniqueToken(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const token = randomBytes(24).toString('hex');
      const existing = await this.shareRepository.findOne({ where: { token } });
      if (!existing) {
        return token;
      }
    }

    return randomBytes(32).toString('hex');
  }
}
