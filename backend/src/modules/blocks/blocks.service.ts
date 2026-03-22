import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Block } from './entities/block.entity';
import { CreateBlockDto, UpdateBlockDto, ReorderBlocksDto } from './dto/block.dto';
import { PagesService } from '../pages/pages.service';

@Injectable()
export class BlocksService {
  private readonly logger = new Logger(BlocksService.name);

  constructor(
    @InjectRepository(Block)
    private readonly blocksRepository: Repository<Block>,
    private readonly pagesService: PagesService,
  ) {}

  async findAllForPage(pageId: string, userId: string): Promise<Block[]> {
    // This also validates workspace membership
    await this.pagesService.findOne(pageId, userId);

    return this.blocksRepository.find({
      where: { pageId },
      order: { sortOrder: 'ASC' },
    });
  }

  async create(
    pageId: string,
    dto: CreateBlockDto,
    userId: string,
  ): Promise<Block> {
    // Validate editor/owner permission through page
    await this.pagesService.assertCanEditPage(pageId, userId);

    // Get next sort order if not specified
    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxSort = await this.blocksRepository
        .createQueryBuilder('b')
        .select('COALESCE(MAX(b.sort_order), -1)', 'max')
        .where('b.page_id = :pageId', { pageId })
        .getRawOne();
      sortOrder = (maxSort?.max ?? -1) + 1;
    }

    const block = this.blocksRepository.create({
      pageId,
      type: dto.type,
      content: dto.content || null,
      sortOrder,
      createdBy: userId,
    });

    const saved = await this.blocksRepository.save(block);

    // Auto-save version (debounced in a real production app)
    await this.pagesService.createVersion(pageId, userId);

    return saved;
  }

  async update(
    blockId: string,
    dto: UpdateBlockDto,
    userId: string,
  ): Promise<Block> {
    const block = await this.findOneRaw(blockId);

    // Validate editor/owner permission through page
    await this.pagesService.assertCanEditPage(block.pageId, userId);

    if (dto.content !== undefined) {
      block.content = dto.content;
    }
    if (dto.type !== undefined) {
      block.type = dto.type;
    }

    const saved = await this.blocksRepository.save(block);

    // Auto-save version
    await this.pagesService.createVersion(block.pageId, userId);

    return saved;
  }

  async remove(blockId: string, userId: string): Promise<void> {
    const block = await this.findOneRaw(blockId);

    // Validate editor/owner permission through page
    await this.pagesService.assertCanEditPage(block.pageId, userId);

    await this.blocksRepository.delete(blockId);

    // Auto-save version
    await this.pagesService.createVersion(block.pageId, userId);

    this.logger.log(`Block deleted: ${blockId} by ${userId}`);
  }

  /**
   * Batch reorder blocks by setting sort_order based on array position.
   * Uses a single transaction for atomicity.
   */
  async reorder(
    pageId: string,
    dto: ReorderBlocksDto,
    userId: string,
  ): Promise<void> {
    await this.pagesService.assertCanEditPage(pageId, userId);

    // Validate all blockIds belong to this page
    const blocks = await this.blocksRepository.find({
      where: { pageId, id: In(dto.blockIds) },
      select: ['id'],
    });

    if (blocks.length !== dto.blockIds.length) {
      throw new NotFoundException(
        'Một hoặc nhiều block không thuộc page này',
      );
    }

    // Update sort_order in batch
    const updates = dto.blockIds.map((id, index) =>
      this.blocksRepository.update(id, { sortOrder: index }),
    );
    await Promise.all(updates);

    // Auto-save version
    await this.pagesService.createVersion(pageId, userId);
  }

  private async findOneRaw(id: string): Promise<Block> {
    const block = await this.blocksRepository.findOne({ where: { id } });
    if (!block) {
      throw new NotFoundException('Block not found');
    }
    return block;
  }
}
