import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Page } from './entities/page.entity';
import { PageVersion } from './entities/page-version.entity';
import { Block } from '../blocks/entities/block.entity';
import { CreatePageDto, UpdatePageDto, MovePageDto } from './dto/page.dto';
import { WorkspacesService } from '../workspaces/workspaces.service';

export interface PageTreeNode {
  id: string;
  title: string;
  icon: string | null;
  sortOrder: number;
  children: PageTreeNode[];
}

const MAX_VERSIONS_PER_PAGE = 50;

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);

  constructor(
    @InjectRepository(Page)
    private readonly pagesRepository: Repository<Page>,
    @InjectRepository(PageVersion)
    private readonly versionsRepository: Repository<PageVersion>,
    @InjectRepository(Block)
    private readonly blocksRepository: Repository<Block>,
    private readonly workspacesService: WorkspacesService,
  ) {}

  // ──── CRUD ────

  async create(
    workspaceId: string,
    dto: CreatePageDto,
    userId: string,
  ): Promise<Page> {
    await this.workspacesService.assertMember(workspaceId, userId);

    // Get next sort order
    const maxSort = await this.pagesRepository
      .createQueryBuilder('p')
      .select('COALESCE(MAX(p.sort_order), -1)', 'max')
      .where('p.workspace_id = :workspaceId', { workspaceId })
      .andWhere(
        dto.parentId
          ? 'p.parent_id = :parentId'
          : 'p.parent_id IS NULL',
        dto.parentId ? { parentId: dto.parentId } : {},
      )
      .getRawOne();

    const page = this.pagesRepository.create({
      workspaceId,
      parentId: dto.parentId || null,
      title: dto.title || 'Untitled',
      icon: dto.icon || null,
      sortOrder: (maxSort?.max ?? -1) + 1,
      createdBy: userId,
    });

    const saved = await this.pagesRepository.save(page);
    this.logger.log(`Page created: ${saved.id} in workspace ${workspaceId}`);
    return saved;
  }

  /**
   * Get nested page tree for a workspace.
   * Builds tree in-memory from flat list for efficiency.
   */
  async getPageTree(
    workspaceId: string,
    userId: string,
  ): Promise<PageTreeNode[]> {
    await this.workspacesService.assertMember(workspaceId, userId);

    const pages = await this.pagesRepository.find({
      where: { workspaceId, isDeleted: false },
      order: { sortOrder: 'ASC' },
      select: ['id', 'parentId', 'title', 'icon', 'sortOrder'],
    });

    return this.buildTree(pages);
  }

  async findOne(id: string, userId: string): Promise<Page> {
    const page = await this.pagesRepository.findOne({
      where: { id, isDeleted: false },
      relations: ['blocks'],
    });
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.workspacesService.assertMember(page.workspaceId, userId);

    // Sort blocks by sort_order
    if (page.blocks) {
      page.blocks.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return page;
  }

  async update(id: string, dto: UpdatePageDto, userId: string): Promise<Page> {
    const page = await this.findOneRaw(id);
    await this.workspacesService.assertMember(page.workspaceId, userId);

    Object.assign(page, dto);
    return this.pagesRepository.save(page);
  }

  /**
   * Soft delete — sets isDeleted = true instead of removing from DB.
   * Allows recovery and keeps references intact.
   */
  async softDelete(id: string, userId: string): Promise<void> {
    const page = await this.findOneRaw(id);
    await this.workspacesService.assertMember(page.workspaceId, userId);

    page.isDeleted = true;
    await this.pagesRepository.save(page);

    // Also soft-delete all children recursively
    await this.softDeleteChildren(id);

    this.logger.log(`Page soft-deleted: ${id} by ${userId}`);
  }

  async movePage(
    id: string,
    dto: MovePageDto,
    userId: string,
  ): Promise<Page> {
    const page = await this.findOneRaw(id);
    await this.workspacesService.assertMember(page.workspaceId, userId);

    // Prevent moving page to its own descendant (circular reference)
    if (dto.parentId) {
      const isDescendant = await this.isDescendant(id, dto.parentId);
      if (isDescendant) {
        throw new NotFoundException(
          'Không thể di chuyển page vào trang con của chính nó',
        );
      }
    }

    page.parentId = dto.parentId ?? null;
    return this.pagesRepository.save(page);
  }

  // ──── Version History ────

  /**
   * Create a snapshot of the current page state.
   * Only saves if content has changed since last version.
   * Keeps max 50 versions per page.
   */
  async createVersion(pageId: string, userId: string): Promise<void> {
    const blocks = await this.blocksRepository.find({
      where: { pageId },
      order: { sortOrder: 'ASC' },
    });

    const snapshot = JSON.stringify(blocks);

    // Only save if different from last version
    const lastVersion = await this.versionsRepository.findOne({
      where: { pageId },
      order: { createdAt: 'DESC' },
    });

    if (lastVersion?.snapshot === snapshot) return;

    await this.versionsRepository.save(
      this.versionsRepository.create({
        pageId,
        snapshot,
        createdBy: userId,
      }),
    );

    // Prune old versions — keep max 50
    const count = await this.versionsRepository.count({ where: { pageId } });
    if (count > MAX_VERSIONS_PER_PAGE) {
      const oldest = await this.versionsRepository.findOne({
        where: { pageId },
        order: { createdAt: 'ASC' },
      });
      if (oldest) {
        await this.versionsRepository.delete(oldest.id);
      }
    }
  }

  async getVersions(pageId: string, userId: string): Promise<PageVersion[]> {
    const page = await this.findOneRaw(pageId);
    await this.workspacesService.assertMember(page.workspaceId, userId);

    return this.versionsRepository.find({
      where: { pageId },
      order: { createdAt: 'DESC' },
      select: ['id', 'pageId', 'createdBy', 'createdAt'],
    });
  }

  /**
   * Restore a page to a previous version.
   * Replaces all current blocks with the snapshot data.
   */
  async restoreVersion(
    pageId: string,
    versionId: string,
    userId: string,
  ): Promise<void> {
    const page = await this.findOneRaw(pageId);
    await this.workspacesService.assertMember(page.workspaceId, userId);

    const version = await this.versionsRepository.findOne({
      where: { id: versionId, pageId },
    });
    if (!version) {
      throw new NotFoundException('Version not found');
    }

    // Save current state as a new version before restoring
    await this.createVersion(pageId, userId);

    // Delete all current blocks
    await this.blocksRepository.delete({ pageId });

    // Restore blocks from snapshot
    const blocks = JSON.parse(version.snapshot) as Partial<Block>[];
    for (const blockData of blocks) {
      const newBlock = this.blocksRepository.create({
        ...blockData,
        id: uuidv4(), // New IDs to avoid conflicts
        pageId,
      });
      await this.blocksRepository.save(newBlock);
    }

    this.logger.log(
      `Page ${pageId} restored to version ${versionId} by ${userId}`,
    );
  }

  // ──── Export ────

  /**
   * Export page content as Markdown.
   * Converts Tiptap JSON blocks to Markdown syntax.
   */
  async exportMarkdown(pageId: string, userId: string): Promise<string> {
    const page = await this.findOne(pageId, userId);
    const lines: string[] = [`# ${page.title}`, ''];

    for (const block of page.blocks || []) {
      lines.push(this.blockToMarkdown(block));
    }

    return lines.join('\n');
  }

  // ──── Private helpers ────

  private async findOneRaw(id: string): Promise<Page> {
    const page = await this.pagesRepository.findOne({
      where: { id },
    });
    if (!page) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  private buildTree(pages: Page[]): PageTreeNode[] {
    const map = new Map<string, PageTreeNode>();
    const roots: PageTreeNode[] = [];

    // First pass: create all nodes
    for (const page of pages) {
      map.set(page.id, {
        id: page.id,
        title: page.title,
        icon: page.icon,
        sortOrder: page.sortOrder,
        children: [],
      });
    }

    // Second pass: build tree
    for (const page of pages) {
      const node = map.get(page.id)!;
      if (page.parentId && map.has(page.parentId)) {
        map.get(page.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  private async softDeleteChildren(parentId: string): Promise<void> {
    const children = await this.pagesRepository.find({
      where: { parentId, isDeleted: false },
    });
    for (const child of children) {
      child.isDeleted = true;
      await this.pagesRepository.save(child);
      await this.softDeleteChildren(child.id);
    }
  }

  private async isDescendant(
    pageId: string,
    potentialDescendantId: string,
  ): Promise<boolean> {
    if (pageId === potentialDescendantId) return true;

    const children = await this.pagesRepository.find({
      where: { parentId: pageId, isDeleted: false },
      select: ['id'],
    });

    for (const child of children) {
      if (await this.isDescendant(child.id, potentialDescendantId)) {
        return true;
      }
    }

    return false;
  }

  private blockToMarkdown(block: Block): string {
    let text = '';

    // Try to extract text from Tiptap JSON content
    if (block.content) {
      try {
        const json = JSON.parse(block.content);
        text = this.extractTextFromTiptap(json);
      } catch {
        text = block.content; // Fallback to raw content
      }
    }

    switch (block.type) {
      case 'heading1':
        return `# ${text}\n`;
      case 'heading2':
        return `## ${text}\n`;
      case 'heading3':
        return `### ${text}\n`;
      case 'bulletList':
        return `- ${text}\n`;
      case 'orderedList':
        return `1. ${text}\n`;
      case 'taskList':
        return `- [ ] ${text}\n`;
      case 'codeBlock':
        return `\`\`\`\n${text}\n\`\`\`\n`;
      case 'quote':
        return `> ${text}\n`;
      case 'divider':
        return '---\n';
      case 'image':
        return `![image](${text})\n`;
      default:
        return `${text}\n`;
    }
  }

  private extractTextFromTiptap(node: Record<string, unknown>): string {
    if (node.type === 'text' && typeof node.text === 'string') {
      return node.text;
    }

    if (Array.isArray(node.content)) {
      return (node.content as Record<string, unknown>[])
        .map((child) => this.extractTextFromTiptap(child))
        .join('');
    }

    return '';
  }
}
