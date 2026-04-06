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
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

@ApiTags('Comments')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('blocks/:bid/comments')
  @ApiOperation({ summary: 'Danh sách comments của block' })
  findAll(
    @Param('bid') blockId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.commentsService.findAllForBlock(blockId, userId);
  }

  @Post('blocks/:bid/comments')
  @ApiOperation({ summary: 'Tạo comment mới' })
  create(
    @Param('bid') blockId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.commentsService.create(blockId, dto, userId);
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Sửa comment (chỉ tác giả)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.commentsService.update(id, dto, userId);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Xoá comment (chỉ tác giả)' })
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.commentsService.remove(id, userId);
  }
}
