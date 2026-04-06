import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ShareService } from './share.service';
import { CreateShareDto } from './dto/create-share.dto';

@ApiTags('Share')
@Controller()
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post('pages/:id/share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a share link for a page' })
  create(
    @Param('id') pageId: string,
    @Body() dto: CreateShareDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.shareService.create(pageId, userId, dto);
  }

  @Get('share/:token')
  @ApiOperation({ summary: 'Resolve shared page by token' })
  resolve(@Param('token') token: string) {
    return this.shareService.resolve(token);
  }
}
