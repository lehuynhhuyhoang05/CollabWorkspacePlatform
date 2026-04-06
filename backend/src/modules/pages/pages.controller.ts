import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagesService } from './pages.service';
import { CreatePageDto, UpdatePageDto, MovePageDto } from './dto/page.dto';

@ApiTags('Pages')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get('workspaces/:wid/pages')
  @ApiOperation({ summary: 'Lấy cây pages (nested) của workspace' })
  @ApiParam({ name: 'wid', description: 'Workspace ID' })
  getPageTree(
    @Param('wid') workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.pagesService.getPageTree(workspaceId, userId);
  }

  @Post('workspaces/:wid/pages')
  @ApiOperation({ summary: 'Tạo page mới' })
  create(
    @Param('wid') workspaceId: string,
    @Body() dto: CreatePageDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.pagesService.create(workspaceId, dto, userId);
  }

  @Get('pages/:id')
  @ApiOperation({ summary: 'Chi tiết page + blocks' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.pagesService.findOne(id, userId);
  }

  @Patch('pages/:id')
  @ApiOperation({ summary: 'Cập nhật page (title/icon/cover)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.pagesService.update(id, dto, userId);
  }

  @Delete('pages/:id')
  @ApiOperation({ summary: 'Xoá page (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.pagesService.softDelete(id, userId);
  }

  @Patch('pages/:id/move')
  @ApiOperation({ summary: 'Di chuyển page (thay đổi parent)' })
  move(
    @Param('id') id: string,
    @Body() dto: MovePageDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.pagesService.movePage(id, dto, userId);
  }

  @Get('pages/:id/versions')
  @ApiOperation({ summary: 'Danh sách version history' })
  getVersions(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.pagesService.getVersions(id, userId);
  }

  @Post('pages/:id/versions/restore')
  @ApiOperation({ summary: 'Khôi phục page về version cũ' })
  restoreVersion(
    @Param('id') pageId: string,
    @Body('versionId') versionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.pagesService.restoreVersion(pageId, versionId, userId);
  }

  @Get('pages/:id/export/markdown')
  @ApiOperation({ summary: 'Export page ra Markdown' })
  async exportMarkdown(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    const markdown = await this.pagesService.exportMarkdown(id, userId);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="page-${id}.md"`,
    );
    res.send(markdown);
  }
}
