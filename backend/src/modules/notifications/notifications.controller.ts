import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'Inbox notifications của user hiện tại' })
  listInbox(
    @CurrentUser('id') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const unreadOnlyFlag = unreadOnly === '1' || unreadOnly === 'true';
    return this.notificationsService.listInbox(userId, unreadOnlyFlag);
  }

  @Get('notifications/messages/threads')
  @ApiOperation({ summary: 'Danh sách hội thoại nhắn tin của user hiện tại' })
  listMessageThreads(@CurrentUser('id') userId: string) {
    return this.notificationsService.listMessageThreads(userId);
  }

  @Get('notifications/messages/contacts')
  @ApiOperation({
    summary: 'Danh sách người có thể nhắn tin (chung workspace)',
  })
  listMessageContacts(@CurrentUser('id') userId: string) {
    return this.notificationsService.listMessageContacts(userId);
  }

  @Get('notifications/messages/thread/:userId')
  @ApiOperation({ summary: 'Danh sách tin nhắn với 1 user' })
  listMessageThread(
    @CurrentUser('id') userId: string,
    @Param('userId') counterpartId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit || '120');
    return this.notificationsService.listMessageThread(
      userId,
      counterpartId,
      Number.isNaN(parsedLimit) ? 120 : parsedLimit,
    );
  }

  @Patch('notifications/messages/thread/:userId/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc toàn bộ tin nhắn trong hội thoại' })
  markMessageThreadAsRead(
    @CurrentUser('id') userId: string,
    @Param('userId') counterpartId: string,
  ) {
    return this.notificationsService.markMessageThreadAsRead(
      userId,
      counterpartId,
    );
  }

  @Post('notifications/messages')
  @ApiOperation({ summary: 'Gửi tin nhắn trực tiếp cho user khác' })
  sendMessage(@CurrentUser('id') userId: string, @Body() dto: SendMessageDto) {
    return this.notificationsService.sendDirectMessage(
      userId,
      dto.recipientId,
      dto.content,
      dto.workspaceId,
    );
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Đánh dấu 1 notification là đã đọc' })
  markAsRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('notifications/read-all')
  @ApiOperation({ summary: 'Đánh dấu toàn bộ inbox là đã đọc' })
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Post('notifications/reminders/due-soon')
  @ApiOperation({
    summary: 'Tạo reminder cho task sắp đến hạn của user hiện tại',
  })
  runDueSoonReminders(
    @CurrentUser('id') userId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.notificationsService.runDueSoonRemindersForUser(
      userId,
      workspaceId,
    );
  }

  @Get('workspaces/:wid/activities')
  @ApiOperation({ summary: 'Activity feed theo workspace' })
  listWorkspaceActivities(
    @Param('wid') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit || '30');
    return this.notificationsService.listWorkspaceActivities(
      workspaceId,
      userId,
      Number.isNaN(parsedLimit) ? 30 : parsedLimit,
    );
  }
}
