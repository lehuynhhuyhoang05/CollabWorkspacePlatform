import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SearchService } from './search.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

@ApiTags('Search')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  @Get('workspaces/:wid/search')
  @ApiOperation({ summary: 'Full-text search trong workspace' })
  @ApiQuery({ name: 'q', description: 'Từ khoá tìm kiếm (tối thiểu 2 ký tự)' })
  async search(
    @Param('wid') workspaceId: string,
    @Query('q') query: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.workspacesService.assertMember(workspaceId, userId);
    return this.searchService.search(workspaceId, query);
  }
}
