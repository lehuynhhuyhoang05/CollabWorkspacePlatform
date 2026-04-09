import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GoogleIntegrationsService } from './google-integrations.service';
import { ExchangeGoogleCodeDto } from './dto/google-auth.dto';
import {
  CreateGoogleCalendarEventDto,
  EnqueueTaskSyncJobDto,
  GoogleCalendarEventDetailQueryDto,
  ListGoogleCalendarEventsQueryDto,
  RunBidirectionalSyncQueryDto,
  RunGoogleSyncJobsQueryDto,
  UpdateGoogleCalendarEventDto,
  UpdateGoogleCalendarEventRsvpDto,
} from './dto/google-calendar.dto';
import { GoogleSyncJobStatus } from './entities/google-calendar-sync-job.entity';

@ApiTags('Google Integrations')
@ApiBearerAuth('access-token')
@Controller('integrations/google')
@UseGuards(JwtAuthGuard)
export class GoogleIntegrationsController {
  constructor(
    private readonly googleIntegrationsService: GoogleIntegrationsService,
  ) {}

  @Get('oauth/url')
  @ApiOperation({ summary: 'Lấy Google OAuth URL để kết nối account' })
  getOauthUrl(
    @CurrentUser('id') userId: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    return this.googleIntegrationsService.getOauthUrl(userId, redirectUri);
  }

  @Post('oauth/exchange')
  @ApiOperation({ summary: 'Exchange Google OAuth code thành access token' })
  exchangeCode(
    @CurrentUser('id') userId: string,
    @Body() dto: ExchangeGoogleCodeDto,
  ) {
    return this.googleIntegrationsService.exchangeCode(
      userId,
      dto.code,
      dto.redirectUri,
    );
  }

  @Get('status')
  @ApiOperation({ summary: 'Kiểm tra trạng thái kết nối Google' })
  getStatus(@CurrentUser('id') userId: string) {
    return this.googleIntegrationsService.getStatus(userId);
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Ngắt kết nối Google account' })
  disconnect(@CurrentUser('id') userId: string) {
    return this.googleIntegrationsService.disconnect(userId);
  }

  @Post('calendar/events')
  @ApiOperation({ summary: 'Tạo Google Calendar event (có thể gắn task)' })
  createCalendarEvent(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGoogleCalendarEventDto,
  ) {
    return this.googleIntegrationsService.createCalendarEvent(userId, dto);
  }

  @Get('calendar/events/:eventId')
  @ApiOperation({ summary: 'Chi tiết một Google Calendar event' })
  getCalendarEvent(
    @CurrentUser('id') userId: string,
    @Param('eventId') eventId: string,
    @Query() query: GoogleCalendarEventDetailQueryDto,
  ) {
    return this.googleIntegrationsService.getCalendarEvent(userId, eventId, query);
  }

  @Patch('calendar/events/:eventId')
  @ApiOperation({ summary: 'Cập nhật Google Calendar event (title/time/attendee/recurring)' })
  updateCalendarEvent(
    @CurrentUser('id') userId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateGoogleCalendarEventDto,
  ) {
    return this.googleIntegrationsService.updateCalendarEvent(userId, eventId, dto);
  }

  @Patch('calendar/events/:eventId/rsvp')
  @ApiOperation({ summary: 'Cập nhật RSVP trạng thái attendee cho event' })
  updateCalendarEventRsvp(
    @CurrentUser('id') userId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateGoogleCalendarEventRsvpDto,
  ) {
    return this.googleIntegrationsService.updateCalendarEventRsvp(userId, eventId, dto);
  }

  @Get('calendar/events')
  @ApiOperation({ summary: 'Danh sách upcoming events từ Google Calendar' })
  listCalendarEvents(
    @CurrentUser('id') userId: string,
    @Query() query: ListGoogleCalendarEventsQueryDto,
  ) {
    return this.googleIntegrationsService.listCalendarEvents(userId, query);
  }

  @Post('calendar/jobs/task/:taskId')
  @ApiOperation({ summary: 'Đưa task vào hàng đợi sync Google Calendar' })
  enqueueTaskSyncJob(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: EnqueueTaskSyncJobDto,
  ) {
    return this.googleIntegrationsService.enqueueTaskSyncJob(
      userId,
      taskId,
      dto,
    );
  }

  @Get('calendar/jobs')
  @ApiOperation({ summary: 'Danh sách Google sync jobs của user' })
  listSyncJobs(
    @CurrentUser('id') userId: string,
    @Query('status') status?: GoogleSyncJobStatus,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit || '30');
    return this.googleIntegrationsService.listSyncJobs(
      userId,
      status,
      Number.isNaN(parsedLimit) ? 30 : parsedLimit,
    );
  }

  @Patch('calendar/jobs/run')
  @ApiOperation({ summary: 'Chạy sync jobs theo batch + retry policy' })
  runSyncJobs(
    @CurrentUser('id') userId: string,
    @Query() query: RunGoogleSyncJobsQueryDto,
  ) {
    return this.googleIntegrationsService.runSyncJobs(
      userId,
      query.limit,
      query.workspaceId,
    );
  }

  @Patch('calendar/sync/bidirectional')
  @ApiOperation({ summary: 'Đồng bộ 2 chiều task <-> Google events, có xử lý conflict' })
  runBidirectionalSync(
    @CurrentUser('id') userId: string,
    @Query() query: RunBidirectionalSyncQueryDto,
  ) {
    return this.googleIntegrationsService.runBidirectionalSync(
      userId,
      query.limit,
      query.workspaceId,
      query.conflictStrategy,
    );
  }

  @Get('audit')
  @ApiOperation({ summary: 'Danh sách audit log Google integration' })
  listAuditLogs(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit || '30');
    return this.googleIntegrationsService.listAuditLogs(
      userId,
      Number.isNaN(parsedLimit) ? 30 : parsedLimit,
    );
  }
}
