import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page } from '../pages/entities/page.entity';
import { Block } from '../blocks/entities/block.entity';

export interface SearchResult {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  matchType: 'title' | 'content';
  snippet: string;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Page)
    private readonly pagesRepository: Repository<Page>,
    @InjectRepository(Block)
    private readonly blocksRepository: Repository<Block>,
  ) {}

  /**
   * Full-text search across page titles and block content within a workspace.
   * Uses ILIKE for PostgreSQL (Phase 1), can be replaced with Oracle Text for Phase 2.
   */
  async search(
    workspaceId: string,
    query: string,
  ): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;
    const results: SearchResult[] = [];

    // Search page titles
    const titleMatches = await this.pagesRepository
      .createQueryBuilder('p')
      .select(['p.id', 'p.title', 'p.icon'])
      .where('p.workspace_id = :workspaceId', { workspaceId })
      .andWhere('p.is_deleted = :isDeleted', { isDeleted: false })
      .andWhere('LOWER(p.title) LIKE LOWER(:searchTerm)', { searchTerm })
      .take(10)
      .getMany();

    for (const page of titleMatches) {
      results.push({
        pageId: page.id,
        pageTitle: page.title,
        pageIcon: page.icon,
        matchType: 'title',
        snippet: this.highlightMatch(page.title, query),
      });
    }

    // Search block content
    const contentMatches = await this.blocksRepository
      .createQueryBuilder('b')
      .innerJoin('b.page', 'p')
      .select(['b.content', 'b.pageId', 'p.id', 'p.title', 'p.icon'])
      .where('p.workspace_id = :workspaceId', { workspaceId })
      .andWhere('p.is_deleted = :isDeleted', { isDeleted: false })
      .andWhere('b.content IS NOT NULL')
      .andWhere('LOWER(b.content) LIKE LOWER(:searchTerm)', { searchTerm })
      .take(10)
      .getMany();

    for (const block of contentMatches) {
      // Avoid duplicates if page already matched by title
      if (results.some((r) => r.pageId === block.pageId && r.matchType === 'title')) {
        continue;
      }

      const textContent = this.extractPlainText(block.content);
      results.push({
        pageId: block.pageId,
        pageTitle: block.page?.title || 'Untitled',
        pageIcon: block.page?.icon || null,
        matchType: 'content',
        snippet: this.extractSnippet(textContent, query),
      });
    }

    return results.slice(0, 20); // Cap at 20 results
  }

  // ──── Helpers ────

  private highlightMatch(text: string, query: string): string {
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return text.replace(regex, '**$1**');
  }

  private extractSnippet(text: string, query: string, contextLen = 60): string {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);

    if (idx === -1) return text.substring(0, contextLen * 2);

    const start = Math.max(0, idx - contextLen);
    const end = Math.min(text.length, idx + query.length + contextLen);
    let snippet = text.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return this.highlightMatch(snippet, query);
  }

  private extractPlainText(content: string | null): string {
    if (!content) return '';
    try {
      const json = JSON.parse(content);
      return this.extractTextRecursive(json);
    } catch {
      return content;
    }
  }

  private extractTextRecursive(node: Record<string, unknown>): string {
    if (node.type === 'text' && typeof node.text === 'string') {
      return node.text;
    }

    if (Array.isArray(node.content)) {
      return (node.content as Record<string, unknown>[])
        .map((child) => this.extractTextRecursive(child))
        .join(' ');
    }

    return '';
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
