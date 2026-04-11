import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BlocksService } from './blocks.service';
import {
  CreateBlockDto,
  UpdateBlockDto,
  ReorderBlocksDto,
} from './dto/block.dto';

@ApiTags('Blocks')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get('pages/:pid/blocks')
  @ApiOperation({ summary: 'Danh sách blocks của page' })
  findAll(@Param('pid') pageId: string, @CurrentUser('id') userId: string) {
    return this.blocksService.findAllForPage(pageId, userId);
  }

  @Post('pages/:pid/blocks')
  @ApiOperation({ summary: 'Tạo block mới' })
  create(
    @Param('pid') pageId: string,
    @Body() dto: CreateBlockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.blocksService.create(pageId, dto, userId);
  }

  @Patch('blocks/:id')
  @ApiOperation({ summary: 'Cập nhật block content' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBlockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.blocksService.update(id, dto, userId);
  }

  @Delete('blocks/:id')
  @ApiOperation({ summary: 'Xoá block' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.blocksService.remove(id, userId);
  }

  @Patch('blocks/:id/move')
  @ApiOperation({ summary: 'Reorder blocks' })
  reorder(
    @Param('id') pageId: string,
    @Body() dto: ReorderBlocksDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.blocksService.reorder(pageId, dto, userId);
  }
}
