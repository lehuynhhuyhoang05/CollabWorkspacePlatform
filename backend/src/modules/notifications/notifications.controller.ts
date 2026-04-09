import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

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

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Đánh dấu 1 notification là đã đọc' })
  markAsRead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('notifications/read-all')
  @ApiOperation({ summary: 'Đánh dấu toàn bộ inbox là đã đọc' })
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Post('notifications/reminders/due-soon')
  @ApiOperation({ summary: 'Tạo reminder cho task sắp đến hạn của user hiện tại' })
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
