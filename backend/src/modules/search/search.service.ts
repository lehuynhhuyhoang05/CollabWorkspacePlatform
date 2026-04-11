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
    limit = 20,
  ): Promise<SearchResult[]> {
    const normalizedQuery = query?.trim().replace(/\s+/g, ' ') || '';
    if (!normalizedQuery || normalizedQuery.length < 2) {
      return [];
    }

    const cappedLimit = Math.min(Math.max(limit, 1), 50);
    const queryForSearch = normalizedQuery.slice(0, 100);
    const searchTerm = `%${queryForSearch}%`;
    const titleTake = Math.min(10, cappedLimit);
    const contentTake = Math.max(cappedLimit, 10);

    const results: SearchResult[] = [];
    const titleMatchedPageIds = new Set<string>();

    const [titleMatches, contentMatches] = await Promise.all([
      this.pagesRepository
        .createQueryBuilder('p')
        .select(['p.id', 'p.title', 'p.icon'])
        .where('p.workspace_id = :workspaceId', { workspaceId })
        .andWhere('p.is_deleted = :isDeleted', { isDeleted: false })
        .andWhere('p.title ILIKE :searchTerm', { searchTerm })
        .take(titleTake)
        .getMany(),

      this.blocksRepository
        .createQueryBuilder('b')
        .innerJoin('b.page', 'p')
        .select('b.page_id', 'pageId')
        .addSelect('b.content', 'content')
        .addSelect('p.title', 'pageTitle')
        .addSelect('p.icon', 'pageIcon')
        .where('p.workspace_id = :workspaceId', { workspaceId })
        .andWhere('p.is_deleted = :isDeleted', { isDeleted: false })
        .andWhere('b.content IS NOT NULL')
        .andWhere('b.content ILIKE :searchTerm', { searchTerm })
        .take(contentTake)
        .getRawMany<{
          pageId: string;
          content: string | null;
          pageTitle: string | null;
          pageIcon: string | null;
        }>(),
    ]);

    // Add title hits first for stronger ranking.
    for (const page of titleMatches) {
      titleMatchedPageIds.add(page.id);
      results.push({
        pageId: page.id,
        pageTitle: page.title,
        pageIcon: page.icon,
        matchType: 'title',
        snippet: this.highlightMatch(page.title, queryForSearch),
      });

      if (results.length >= cappedLimit) {
        return results;
      }
    }

    for (const block of contentMatches) {
      // Avoid duplicate page entries when already matched by title.
      if (titleMatchedPageIds.has(block.pageId)) {
        continue;
      }

      const textContent = this.extractPlainText(block.content);
      results.push({
        pageId: block.pageId,
        pageTitle: block.pageTitle || 'Untitled',
        pageIcon: block.pageIcon || null,
        matchType: 'content',
        snippet: this.extractSnippet(textContent, queryForSearch),
      });

      if (results.length >= cappedLimit) {
        break;
      }
    }

    return results;
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
      const json: unknown = JSON.parse(content);
      if (!this.isRecord(json)) {
        return content;
      }

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
      return node.content
        .filter((child): child is Record<string, unknown> =>
          this.isRecord(child),
        )
        .map((child) => this.extractTextRecursive(child))
        .join(' ');
    }

    return '';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
