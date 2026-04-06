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
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số kết quả tối đa (1-50), mặc định 20',
  })
  async search(
    @Param('wid') workspaceId: string,
    @Query('q') query: string,
    @Query('limit') limit: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.workspacesService.assertMember(workspaceId, userId);
    const parsedLimit = Number(limit);
    return this.searchService.search(
      workspaceId,
      query,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }
}
