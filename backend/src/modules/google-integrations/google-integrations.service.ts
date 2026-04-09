import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { GoogleAccount } from './entities/google-account.entity';
import {
  GoogleCalendarSyncJob,
  GoogleSyncJobStatus,
} from './entities/google-calendar-sync-job.entity';
import { GoogleIntegrationAuditLog } from './entities/google-integration-audit-log.entity';
import { Task } from '../tasks/entities/task.entity';
import { WorkspaceMember, WorkspaceRole } from '../workspaces/entities/workspace-member.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import {
  CreateGoogleCalendarEventDto,
  EnqueueTaskSyncJobDto,
  GOOGLE_SYNC_CONFLICT_STRATEGIES,
  GoogleCalendarEventDetailQueryDto,
  ListGoogleCalendarEventsQueryDto,
  UpdateGoogleCalendarEventDto,
  UpdateGoogleCalendarEventRsvpDto,
} from './dto/google-calendar.dto';

interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GoogleCalendarEventResponse {
  id?: string;
  etag?: string;
  updated?: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  status?: string;
  location?: string;
  hangoutLink?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
    }>;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    optional?: boolean;
    responseStatus?: string;
    self?: boolean;
  }>;
  recurrence?: string[];
  error?: {
    message?: string;
  };
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarEventResponse[];
  nextPageToken?: string;
  error?: {
    message?: string;
  };
}

interface ParsedUserFromIdToken {
  email?: string;
}

export interface CreateCalendarEventResult {
  eventId: string;
  calendarId: string;
  eventUrl: string | null;
  meetUrl: string | null;
  syncedTaskId: string | null;
}

export interface GoogleCalendarEventListItem {
  eventId: string;
  etag: string | null;
  updatedAt: string | null;
  summary: string;
  description: string | null;
  status: string | null;
  startAt: string | null;
  endAt: string | null;
  isAllDay: boolean;
  eventUrl: string | null;
  meetUrl: string | null;
  location: string | null;
  attendees: Array<{
    email: string;
    displayName: string | null;
    optional: boolean;
    responseStatus: string | null;
    self: boolean;
  }>;
  recurrence: string[];
  calendarId: string;
}

export interface GoogleCalendarEventDetail extends GoogleCalendarEventListItem {}

export interface BidirectionalSyncSummary {
  scanned: number;
  pushedToGoogle: number;
  pulledFromGoogle: number;
  conflicts: number;
  skipped: number;
  failed: number;
  strategy: (typeof GOOGLE_SYNC_CONFLICT_STRATEGIES)[number];
}

@Injectable()
export class GoogleIntegrationsService {
  constructor(
    @InjectRepository(GoogleAccount)
    private readonly googleAccountsRepository: Repository<GoogleAccount>,
    @InjectRepository(GoogleCalendarSyncJob)
    private readonly syncJobsRepository: Repository<GoogleCalendarSyncJob>,
    @InjectRepository(GoogleIntegrationAuditLog)
    private readonly auditLogsRepository: Repository<GoogleIntegrationAuditLog>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepository: Repository<WorkspaceMember>,
    private readonly workspacesService: WorkspacesService,
    private readonly configService: ConfigService,
  ) {}

  getOauthUrl(userId: string, redirectUri?: string): {
    url: string;
    redirectUri: string;
    scopes: string[];
  } {
    const clientId = this.getRequiredConfig('GOOGLE_CLIENT_ID');
    const resolvedRedirectUri = this.getRedirectUri(redirectUri);
    const scopes = this.getScopes();

    const statePayload = Buffer.from(
      JSON.stringify({
        userId,
        ts: Date.now(),
      }),
    ).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: resolvedRedirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: statePayload,
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      redirectUri: resolvedRedirectUri,
      scopes,
    };
  }

  async exchangeCode(
    userId: string,
    code: string,
    redirectUri?: string,
  ): Promise<{
    connected: boolean;
    googleEmail: string | null;
    tokenExpiresAt: string | null;
    scopes: string[];
  }> {
    const resolvedRedirectUri = this.getRedirectUri(redirectUri);

    try {
      const tokenResponse = await this.exchangeAuthorizationCode(
        code,
        resolvedRedirectUri,
      );

      if (!tokenResponse.access_token) {
        throw new BadRequestException(
          tokenResponse.error_description ||
            tokenResponse.error ||
            'Không nhận được access token từ Google',
        );
      }

      const existing = await this.googleAccountsRepository.findOne({
        where: { userId },
      });

      const decoded = this.decodeIdToken(tokenResponse.id_token);
      const googleEmail = decoded.email || existing?.googleEmail || null;
      const tokenExpiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;

      const account = existing
        ? Object.assign(existing, {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token || existing.refreshToken,
            tokenExpiresAt,
            scopes: tokenResponse.scope || existing.scopes || null,
            googleEmail,
          })
        : this.googleAccountsRepository.create({
            userId,
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token || null,
            tokenExpiresAt,
            scopes: tokenResponse.scope || null,
            googleEmail,
            lastSyncAt: null,
          });

      await this.googleAccountsRepository.save(account);

      await this.writeAuditLog({
        userId,
        action: 'oauth_exchange',
        status: 'success',
        message: 'Google OAuth exchange thành công',
        requestPayload: { redirectUri: resolvedRedirectUri },
        responsePayload: {
          scopes: account.scopes,
          tokenExpiresAt: account.tokenExpiresAt,
        },
      });

      return {
        connected: true,
        googleEmail: account.googleEmail,
        tokenExpiresAt: account.tokenExpiresAt
          ? account.tokenExpiresAt.toISOString()
          : null,
        scopes: (account.scopes || '').split(' ').filter(Boolean),
      };
    } catch (error) {
      await this.writeAuditLog({
        userId,
        action: 'oauth_exchange',
        status: 'failed',
        message: 'Google OAuth exchange thất bại',
        requestPayload: {
          redirectUri: resolvedRedirectUri,
        },
        responsePayload: {
          error: this.toErrorMessage(error),
        },
      });
      throw error;
    }
  }

  async getStatus(userId: string): Promise<{
    connected: boolean;
    googleEmail: string | null;
    tokenExpiresAt: string | null;
    scopes: string[];
    lastSyncAt: string | null;
  }> {
    const account = await this.googleAccountsRepository.findOne({
      where: { userId },
    });

    if (!account) {
      return {
        connected: false,
        googleEmail: null,
        tokenExpiresAt: null,
        scopes: [],
        lastSyncAt: null,
      };
    }

    return {
      connected: true,
      googleEmail: account.googleEmail,
      tokenExpiresAt: account.tokenExpiresAt
        ? account.tokenExpiresAt.toISOString()
        : null,
      scopes: (account.scopes || '').split(' ').filter(Boolean),
      lastSyncAt: account.lastSyncAt ? account.lastSyncAt.toISOString() : null,
    };
  }

  async disconnect(userId: string): Promise<{ disconnected: boolean }> {
    const account = await this.googleAccountsRepository.findOne({
      where: { userId },
    });

    if (!account) {
      return { disconnected: true };
    }

    await this.googleAccountsRepository.delete(account.id);

    await this.writeAuditLog({
      userId,
      action: 'oauth_disconnect',
      status: 'success',
      message: 'Đã ngắt kết nối Google',
    });

    return { disconnected: true };
  }

  async createCalendarEvent(
    userId: string,
    dto: CreateGoogleCalendarEventDto,
  ): Promise<CreateCalendarEventResult> {
    const account = await this.getActiveAccountOrThrow(userId);
    const accessToken = await this.ensureValidAccessToken(account);

    const taskContext = dto.taskId
      ? await this.loadTaskContextForUser(dto.taskId, userId)
      : null;

    if (!taskContext && !dto.workspaceId) {
      throw new BadRequestException(
        'Cần cung cấp taskId hoặc workspaceId để tạo event',
      );
    }

    if (!taskContext && dto.workspaceId) {
      await this.workspacesService.assertMember(dto.workspaceId, userId);
    }

    const workspaceId = taskContext?.task.workspaceId || dto.workspaceId || null;

    const summary =
      dto.summary?.trim() || taskContext?.task.title || null;

    if (!summary) {
      throw new BadRequestException('Thiếu summary cho calendar event');
    }

    const description =
      dto.description?.trim() || taskContext?.task.description || undefined;

    const allDay = Boolean(dto.allDay);
    const derivedTaskStartAt = this.deriveTaskStartAt(
      taskContext?.task.dueDate || null,
    );
    const startAt = !allDay ? dto.startAt || derivedTaskStartAt : null;

    if (!allDay && !startAt) {
      throw new BadRequestException(
        'Thiếu startAt và task chưa có dueDate để suy ra lịch',
      );
    }

    const startDate =
      dto.startDate || this.deriveTaskStartDate(taskContext?.task.dueDate || null);

    if (allDay && !startDate) {
      throw new BadRequestException(
        'Thiếu startDate cho all-day event',
      );
    }

    const endAt = !allDay && startAt ? dto.endAt || this.deriveDefaultEndAt(startAt) : null;
    const endDate = allDay
      ? dto.endDate || this.deriveDefaultAllDayEndDate(startDate!)
      : null;
    const calendarId = dto.calendarId || 'primary';

    const requestBody: Record<string, unknown> = {
      summary,
      description,
      location: dto.location,
      start: allDay
        ? {
            date: startDate,
          }
        : {
            dateTime: new Date(startAt!).toISOString(),
            timeZone: dto.timezone || 'UTC',
          },
      end: allDay
        ? {
            date: endDate,
          }
        : {
            dateTime: new Date(endAt!).toISOString(),
            timeZone: dto.timezone || 'UTC',
          },
    };

    if (dto.attendees?.length) {
      requestBody.attendees = dto.attendees.map((attendee) => ({
        email: attendee.email,
        displayName: attendee.displayName,
        optional: attendee.optional,
        responseStatus: attendee.responseStatus,
      }));
    }

    if (dto.recurrence?.length) {
      requestBody.recurrence = dto.recurrence;
    }

    const wantsMeet = Boolean(dto.createMeetLink);
    if (wantsMeet) {
      requestBody.conferenceData = {
        createRequest: {
          requestId: uuidv4(),
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      };
    }

    const endpoint =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events` +
      (wantsMeet ? '?conferenceDataVersion=1' : '');

    const createdEvent = await this.callGoogleApiWithRefresh(
      account,
      accessToken,
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    );

    const event = createdEvent as GoogleCalendarEventResponse;
    if (!event.id) {
      throw new BadRequestException(
        event.error?.message || 'Google không trả về eventId',
      );
    }

    const meetUrl =
      event.conferenceData?.entryPoints?.find(
        (entry) => entry.entryPointType === 'video',
      )?.uri || null;

    if (taskContext?.task) {
      taskContext.task.googleEventId = event.id;
      taskContext.task.googleCalendarId = calendarId;
      taskContext.task.googleMeetUrl = wantsMeet ? meetUrl : taskContext.task.googleMeetUrl;
      taskContext.task.googleEventEtag = event.etag || null;
      taskContext.task.googleEventUpdatedAt = this.parseGoogleDateOrNull(
        event.updated,
      );
      taskContext.task.googleTaskLastSyncedAt = new Date();
      taskContext.task.googleLastPulledAt = this.parseGoogleDateOrNull(
        event.updated,
      );
      taskContext.task.googleSyncConflictAt = null;
      taskContext.task.googleSyncConflictMessage = null;
      await this.tasksRepository.save(taskContext.task);
    }

    account.lastSyncAt = new Date();
    await this.googleAccountsRepository.save(account);

    await this.writeAuditLog({
      userId,
      workspaceId,
      action: 'calendar_event_create',
      status: 'success',
      message: `Tạo Google Calendar event thành công (${event.id})`,
      requestPayload: {
        taskId: taskContext?.task?.id || null,
        calendarId,
        summary,
        createMeetLink: wantsMeet,
        allDay,
        recurrence: dto.recurrence || null,
      },
      responsePayload: {
        eventId: event.id,
        etag: event.etag || null,
        updatedAt: event.updated || null,
        eventUrl: event.htmlLink || null,
        meetUrl,
      },
    });

    return {
      eventId: event.id,
      calendarId,
      eventUrl: event.htmlLink || null,
      meetUrl,
      syncedTaskId: taskContext?.task?.id || null,
    };
  }

  async listCalendarEvents(
    userId: string,
    query: ListGoogleCalendarEventsQueryDto,
  ): Promise<{
    calendarId: string;
    items: GoogleCalendarEventListItem[];
    nextPageToken: string | null;
    fetchedAt: string;
  }> {
    const account = await this.getActiveAccountOrThrow(userId);
    const accessToken = await this.ensureValidAccessToken(account);

    if (query.workspaceId) {
      await this.workspacesService.assertMember(query.workspaceId, userId);
    }

    const calendarId = query.calendarId?.trim() || 'primary';
    const maxResults = Math.min(Math.max(query.maxResults || 30, 1), 100);

    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(maxResults),
      timeMin: query.timeMin || new Date().toISOString(),
    });

    if (query.timeMax) {
      params.set('timeMax', query.timeMax);
    }

    if (query.q?.trim()) {
      params.set('q', query.q.trim());
    }

    const endpoint =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events?${params.toString()}`;

    const rawResult = await this.callGoogleApiWithRefresh(
      account,
      accessToken,
      endpoint,
      {
        method: 'GET',
      },
    );

    const parsed = rawResult as GoogleCalendarListResponse;
    const items = (parsed.items || [])
      .filter((event) => Boolean(event.id))
      .map((event) => {
        const startAt = event.start?.dateTime || event.start?.date || null;
        const endAt = event.end?.dateTime || event.end?.date || null;
        const isAllDay =
          !event.start?.dateTime && Boolean(event.start?.date);

        const meetUrl =
          event.hangoutLink ||
          event.conferenceData?.entryPoints?.find(
            (entry) => entry.entryPointType === 'video',
          )?.uri ||
          null;

        return {
          eventId: event.id!,
          etag: event.etag || null,
          updatedAt: event.updated || null,
          summary: event.summary || '(Untitled Event)',
          description: event.description || null,
          status: event.status || null,
          startAt,
          endAt,
          isAllDay,
          eventUrl: event.htmlLink || null,
          meetUrl,
          location: event.location || null,
          attendees: (event.attendees || [])
            .filter((attendee) => Boolean(attendee.email))
            .map((attendee) => ({
              email: attendee.email!,
              displayName: attendee.displayName || null,
              optional: Boolean(attendee.optional),
              responseStatus: attendee.responseStatus || null,
              self: Boolean(attendee.self),
            })),
          recurrence: event.recurrence || [],
          calendarId,
        };
      })
      .sort((a, b) => {
        const aTime = a.startAt
          ? new Date(a.startAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.startAt
          ? new Date(b.startAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });

    return {
      calendarId,
      items,
      nextPageToken: parsed.nextPageToken || null,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getCalendarEvent(
    userId: string,
    eventId: string,
    query: GoogleCalendarEventDetailQueryDto,
  ): Promise<GoogleCalendarEventDetail> {
    const account = await this.getActiveAccountOrThrow(userId);
    const accessToken = await this.ensureValidAccessToken(account);
    const calendarId = query.calendarId?.trim() || 'primary';

    const raw = await this.callGoogleApiWithRefresh(
      account,
      accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
      {
        method: 'GET',
      },
    );

    return this.mapGoogleEventToListItem(
      raw as GoogleCalendarEventResponse,
      calendarId,
    );
  }

  async updateCalendarEvent(
    userId: string,
    eventId: string,
    dto: UpdateGoogleCalendarEventDto,
  ): Promise<GoogleCalendarEventDetail> {
    const account = await this.getActiveAccountOrThrow(userId);
    const accessToken = await this.ensureValidAccessToken(account);

    const taskContext = dto.taskId
      ? await this.loadTaskContextForUser(dto.taskId, userId)
      : null;

    if (!taskContext && dto.workspaceId) {
      await this.workspacesService.assertMember(dto.workspaceId, userId);
    }

    const calendarId = dto.calendarId?.trim() || 'primary';
    const currentEvent = (await this.callGoogleApiWithRefresh(
      account,
      accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
      {
        method: 'GET',
      },
    )) as GoogleCalendarEventResponse;

    if (dto.expectedEtag && currentEvent.etag && dto.expectedEtag !== currentEvent.etag) {
      throw new BadRequestException(
        'Event đã thay đổi trên Google. Vui lòng tải lại trước khi cập nhật.',
      );
    }

    const effectiveAllDay =
      dto.allDay !== undefined
        ? dto.allDay
        : !currentEvent.start?.dateTime && Boolean(currentEvent.start?.date);

    const startAt = dto.startAt || currentEvent.start?.dateTime || null;
    const endAt = dto.endAt || currentEvent.end?.dateTime || null;
    const startDate = dto.startDate || currentEvent.start?.date || null;
    const endDate = dto.endDate || currentEvent.end?.date || null;

    const payload: Record<string, unknown> = {};

    if (dto.summary !== undefined) {
      payload.summary = dto.summary;
    }

    if (dto.description !== undefined) {
      payload.description = dto.description;
    }

    if (dto.location !== undefined) {
      payload.location = dto.location;
    }

    if (effectiveAllDay) {
      if (!startDate) {
        throw new BadRequestException('Thiếu startDate cho all-day event');
      }

      payload.start = {
        date: startDate,
      };
      payload.end = {
        date: endDate || this.deriveDefaultAllDayEndDate(startDate),
      };
    } else if (
      dto.startAt !== undefined ||
      dto.endAt !== undefined ||
      dto.timezone !== undefined ||
      dto.allDay !== undefined
    ) {
      if (!startAt) {
        throw new BadRequestException('Thiếu startAt cho timed event');
      }

      payload.start = {
        dateTime: new Date(startAt).toISOString(),
        timeZone: dto.timezone || 'UTC',
      };
      payload.end = {
        dateTime: new Date(endAt || this.deriveDefaultEndAt(startAt)).toISOString(),
        timeZone: dto.timezone || 'UTC',
      };
    }

    if (dto.attendees !== undefined) {
      payload.attendees = dto.attendees.map((attendee) => ({
        email: attendee.email,
        displayName: attendee.displayName,
        optional: attendee.optional,
        responseStatus: attendee.responseStatus,
      }));
    }

    if (dto.recurrence !== undefined) {
      payload.recurrence = dto.recurrence;
    }

    if (dto.createMeetLink) {
      payload.conferenceData = {
        createRequest: {
          requestId: uuidv4(),
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      };
    }

    const updated = (await this.callGoogleApiWithRefresh(
      account,
      accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(dto.expectedEtag
            ? {
                'If-Match': dto.expectedEtag,
              }
            : {}),
        },
        body: JSON.stringify(payload),
      },
    )) as GoogleCalendarEventResponse;

    const linkedTask = taskContext?.task
      ? taskContext.task
      : await this.tasksRepository.findOne({
          where: {
            googleEventId: eventId,
            ...(dto.workspaceId ? { workspaceId: dto.workspaceId } : {}),
          },
        });

    if (linkedTask) {
      this.applyGoogleEventToTask(linkedTask, updated, calendarId);
      linkedTask.googleTaskLastSyncedAt = new Date();
      linkedTask.googleSyncConflictAt = null;
      linkedTask.googleSyncConflictMessage = null;
      await this.tasksRepository.save(linkedTask);
    }

    await this.writeAuditLog({
      userId,
      workspaceId: linkedTask?.workspaceId || dto.workspaceId || null,
      action: 'calendar_event_update',
      status: 'success',
      message: `Đã cập nhật Google event ${eventId}`,
      requestPayload: {
        calendarId,
        eventId,
        payload,
      },
      responsePayload: {
        etag: updated.etag || null,
        updatedAt: updated.updated || null,
      },
    });

    return this.mapGoogleEventToListItem(updated, calendarId);
  }

  async updateCalendarEventRsvp(
    userId: string,
    eventId: string,
    dto: UpdateGoogleCalendarEventRsvpDto,
  ): Promise<GoogleCalendarEventDetail> {
    const account = await this.getActiveAccountOrThrow(userId);
    const accessToken = await this.ensureValidAccessToken(account);
    const calendarId = dto.calendarId?.trim() || 'primary';

    const currentEvent = (await this.callGoogleApiWithRefresh(
      account,
      accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
      {
        method: 'GET',
      },
    )) as GoogleCalendarEventResponse;

    if (dto.expectedEtag && currentEvent.etag && dto.expectedEtag !== currentEvent.etag) {
      throw new BadRequestException(
        'Event đã thay đổi trên Google. Vui lòng tải lại trước khi cập nhật RSVP.',
      );
    }

    const attendees = [...(currentEvent.attendees || [])];
    const attendeeIndex = attendees.findIndex(
      (attendee) =>
        (attendee.email || '').toLowerCase() === dto.attendeeEmail.toLowerCase(),
    );

    if (attendeeIndex >= 0) {
      attendees[attendeeIndex] = {
        ...attendees[attendeeIndex],
        responseStatus: dto.responseStatus,
      };
    } else {
      attendees.push({
        email: dto.attendeeEmail,
        responseStatus: dto.responseStatus,
      });
    }

    const updated = (await this.callGoogleApiWithRefresh(
      account,
      accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(dto.expectedEtag
            ? {
                'If-Match': dto.expectedEtag,
              }
            : {}),
        },
        body: JSON.stringify({
          attendees,
        }),
      },
    )) as GoogleCalendarEventResponse;

    await this.writeAuditLog({
      userId,
      action: 'calendar_event_rsvp_update',
      status: 'success',
      message: `Đã cập nhật RSVP cho event ${eventId}`,
      requestPayload: {
        calendarId,
        attendeeEmail: dto.attendeeEmail,
        responseStatus: dto.responseStatus,
      },
      responsePayload: {
        etag: updated.etag || null,
      },
    });

    return this.mapGoogleEventToListItem(updated, calendarId);
  }

  async runBidirectionalSync(
    userId: string,
    limit = 50,
    workspaceId?: string,
    conflictStrategy: (typeof GOOGLE_SYNC_CONFLICT_STRATEGIES)[number] = 'mark',
  ): Promise<BidirectionalSyncSummary> {
    if (workspaceId) {
      await this.workspacesService.assertMember(workspaceId, userId);
    }

    const account = await this.getActiveAccountOrThrow(userId);
    const accessToken = await this.ensureValidAccessToken(account);

    const boundedLimit = Math.min(Math.max(limit, 1), 200);
    const query = this.tasksRepository
      .createQueryBuilder('task')
      .innerJoin(
        'workspace_members',
        'wm',
        'wm.workspace_id = task.workspace_id AND wm.user_id = :userId',
        { userId },
      )
      .where('task.google_event_id IS NOT NULL')
      .orderBy('task.updatedAt', 'DESC')
      .take(boundedLimit);

    if (workspaceId) {
      query.andWhere('task.workspace_id = :workspaceId', { workspaceId });
    }

    const linkedTasks = await query.getMany();

    const summary: BidirectionalSyncSummary = {
      scanned: linkedTasks.length,
      pushedToGoogle: 0,
      pulledFromGoogle: 0,
      conflicts: 0,
      skipped: 0,
      failed: 0,
      strategy: conflictStrategy,
    };

    for (const task of linkedTasks) {
      const calendarId = task.googleCalendarId || 'primary';
      const eventId = task.googleEventId;
      if (!eventId) {
        summary.skipped += 1;
        continue;
      }

      try {
        const remoteEvent = (await this.callGoogleApiWithRefresh(
          account,
          accessToken,
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            calendarId,
          )}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
          {
            method: 'GET',
          },
        )) as GoogleCalendarEventResponse;

        const localUpdatedAt = task.updatedAt?.getTime() || 0;
        const taskSnapshotAt = task.googleTaskLastSyncedAt?.getTime() || 0;
        const localChanged = localUpdatedAt > taskSnapshotAt;

        const remoteUpdatedAtDate = this.parseGoogleDateOrNull(
          remoteEvent.updated,
        );
        const remoteUpdatedAt = remoteUpdatedAtDate?.getTime() || 0;
        const remoteSnapshotAt = task.googleLastPulledAt?.getTime() || 0;
        const remoteChanged = remoteUpdatedAt > remoteSnapshotAt;

        if (localChanged && remoteChanged) {
          if (conflictStrategy === 'mark') {
            task.googleSyncConflictAt = new Date();
            task.googleSyncConflictMessage =
              'Task và Google event đều đã thay đổi sau lần sync trước';
            await this.tasksRepository.save(task);

            await this.writeAuditLog({
              userId,
              workspaceId: task.workspaceId,
              action: 'bidirectional_sync_conflict',
              status: 'conflict',
              message: `Conflict task ${task.id} / event ${eventId}`,
              requestPayload: {
                strategy: conflictStrategy,
              },
            });

            summary.conflicts += 1;
            continue;
          }

          if (conflictStrategy === 'prefer_google') {
            this.applyGoogleEventToTask(task, remoteEvent, calendarId);
            task.googleTaskLastSyncedAt = new Date();
            task.googleSyncConflictAt = null;
            task.googleSyncConflictMessage = null;
            await this.tasksRepository.save(task);
            summary.pulledFromGoogle += 1;
            continue;
          }

          const pushedEvent = await this.pushTaskToGoogleEvent(
            account,
            accessToken,
            task,
            remoteEvent,
            calendarId,
          );
          this.applyGoogleEventToTask(task, pushedEvent, calendarId);
          task.googleTaskLastSyncedAt = new Date();
          task.googleSyncConflictAt = null;
          task.googleSyncConflictMessage = null;
          await this.tasksRepository.save(task);
          summary.pushedToGoogle += 1;
          continue;
        }

        if (remoteChanged) {
          this.applyGoogleEventToTask(task, remoteEvent, calendarId);
          task.googleTaskLastSyncedAt = new Date();
          task.googleSyncConflictAt = null;
          task.googleSyncConflictMessage = null;
          await this.tasksRepository.save(task);
          summary.pulledFromGoogle += 1;
          continue;
        }

        if (localChanged) {
          const pushedEvent = await this.pushTaskToGoogleEvent(
            account,
            accessToken,
            task,
            remoteEvent,
            calendarId,
          );
          this.applyGoogleEventToTask(task, pushedEvent, calendarId);
          task.googleTaskLastSyncedAt = new Date();
          task.googleSyncConflictAt = null;
          task.googleSyncConflictMessage = null;
          await this.tasksRepository.save(task);
          summary.pushedToGoogle += 1;
          continue;
        }

        summary.skipped += 1;
      } catch (error) {
        summary.failed += 1;
        task.googleSyncConflictAt = new Date();
        task.googleSyncConflictMessage = this.toErrorMessage(error);
        await this.tasksRepository.save(task);

        await this.writeAuditLog({
          userId,
          workspaceId: task.workspaceId,
          action: 'bidirectional_sync_failed',
          status: 'failed',
          message: this.toErrorMessage(error),
          requestPayload: {
            taskId: task.id,
            eventId,
          },
        });
      }
    }

    return summary;
  }

  async enqueueTaskSyncJob(
    userId: string,
    taskId: string,
    dto: EnqueueTaskSyncJobDto,
  ): Promise<GoogleCalendarSyncJob> {
    const { task } = await this.loadTaskContextForUser(taskId, userId);

    const maxAttempts = this.getMaxAttempts();
    const payload = {
      taskId,
      calendarId: dto.calendarId || 'primary',
      createMeetLink: Boolean(dto.createMeetLink),
    };

    const job = this.syncJobsRepository.create({
      userId,
      workspaceId: task.workspaceId,
      taskId: task.id,
      type: 'syncTaskEvent',
      payload: JSON.stringify(payload),
      status: GoogleSyncJobStatus.PENDING,
      attempts: 0,
      maxAttempts,
      nextRetryAt: null,
      lastError: null,
      processedAt: null,
    });

    const saved = await this.syncJobsRepository.save(job);

    await this.writeAuditLog({
      userId,
      workspaceId: task.workspaceId,
      jobId: saved.id,
      action: 'sync_job_enqueued',
      status: 'success',
      message: 'Đã đưa task vào hàng đợi sync Google Calendar',
      requestPayload: payload,
    });

    return saved;
  }

  async listSyncJobs(
    userId: string,
    status?: GoogleSyncJobStatus,
    limit = 30,
  ): Promise<GoogleCalendarSyncJob[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    return this.syncJobsRepository.find({
      where: status ? { userId, status } : { userId },
      relations: ['task'],
      order: { createdAt: 'DESC' },
      take,
    });
  }

  async runSyncJobs(
    userId: string,
    limit = 10,
    workspaceId?: string,
  ): Promise<{
    processed: number;
    completed: number;
    failed: number;
    retrying: number;
  }> {
    if (workspaceId) {
      await this.workspacesService.assertMember(workspaceId, userId);
    }

    const take = Math.min(Math.max(limit, 1), 100);
    const now = new Date();

    const qb = this.syncJobsRepository
      .createQueryBuilder('job')
      .where('job.user_id = :userId', { userId })
      .andWhere('job.status IN (:...statuses)', {
        statuses: [GoogleSyncJobStatus.PENDING, GoogleSyncJobStatus.RETRYING],
      })
      .andWhere('(job.next_retry_at IS NULL OR job.next_retry_at <= :now)', {
        now,
      })
      .orderBy('job.createdAt', 'ASC')
      .take(take);

    if (workspaceId) {
      qb.andWhere('job.workspace_id = :workspaceId', { workspaceId });
    }

    const jobs = await qb.getMany();

    let completed = 0;
    let failed = 0;
    let retrying = 0;

    for (const job of jobs) {
      const result = await this.processSyncJob(job);
      if (result === GoogleSyncJobStatus.COMPLETED) {
        completed += 1;
      } else if (result === GoogleSyncJobStatus.FAILED) {
        failed += 1;
      } else if (result === GoogleSyncJobStatus.RETRYING) {
        retrying += 1;
      }
    }

    return {
      processed: jobs.length,
      completed,
      failed,
      retrying,
    };
  }

  async listAuditLogs(
    userId: string,
    limit = 30,
  ): Promise<GoogleIntegrationAuditLog[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    return this.auditLogsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take,
    });
  }

  private async processSyncJob(
    job: GoogleCalendarSyncJob,
  ): Promise<GoogleSyncJobStatus> {
    job.status = GoogleSyncJobStatus.PROCESSING;
    job.attempts += 1;
    await this.syncJobsRepository.save(job);

    try {
      const payload = this.parseJobPayload(job.payload);
      if (job.type !== 'syncTaskEvent' || !payload.taskId) {
        throw new BadRequestException('Payload sync job không hợp lệ');
      }

      await this.createCalendarEvent(job.userId, {
        taskId: payload.taskId,
        calendarId: payload.calendarId,
        createMeetLink: payload.createMeetLink,
      });

      job.status = GoogleSyncJobStatus.COMPLETED;
      job.processedAt = new Date();
      job.nextRetryAt = null;
      job.lastError = null;
      await this.syncJobsRepository.save(job);

      await this.writeAuditLog({
        userId: job.userId,
        workspaceId: job.workspaceId,
        jobId: job.id,
        action: 'sync_job_run',
        status: 'success',
        message: 'Sync job hoàn tất',
        requestPayload: payload,
      });

      return GoogleSyncJobStatus.COMPLETED;
    } catch (error) {
      const message = this.toErrorMessage(error);
      const canRetry = job.attempts < job.maxAttempts;

      job.lastError = message;
      if (canRetry) {
        job.status = GoogleSyncJobStatus.RETRYING;
        job.nextRetryAt = this.nextRetryAt(job.attempts);
      } else {
        job.status = GoogleSyncJobStatus.FAILED;
        job.processedAt = new Date();
        job.nextRetryAt = null;
      }

      await this.syncJobsRepository.save(job);

      await this.writeAuditLog({
        userId: job.userId,
        workspaceId: job.workspaceId,
        jobId: job.id,
        action: 'sync_job_run',
        status: canRetry ? 'retrying' : 'failed',
        message,
      });

      return canRetry ? GoogleSyncJobStatus.RETRYING : GoogleSyncJobStatus.FAILED;
    }
  }

  private async loadTaskContextForUser(taskId: string, userId: string): Promise<{
    task: Task;
    role: WorkspaceRole;
  }> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      relations: ['workspace'],
    });

    if (!task) {
      throw new NotFoundException('Task không tồn tại');
    }

    const role = await this.workspacesService.getMemberRole(task.workspaceId, userId);
    if (!role) {
      throw new ForbiddenException('Bạn không thuộc workspace của task này');
    }

    const isOwnerOrEditor =
      role === WorkspaceRole.OWNER || role === WorkspaceRole.EDITOR;
    const isAssignee = task.assigneeId === userId;

    if (!isOwnerOrEditor && !isAssignee) {
      throw new ForbiddenException('Bạn không có quyền sync task này');
    }

    return {
      task,
      role,
    };
  }

  private deriveTaskStartAt(dueDate: Date | string | null): string | null {
    if (!dueDate) {
      return null;
    }

    const parsed = dueDate instanceof Date ? dueDate : new Date(dueDate);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString();
  }

  private deriveTaskStartDate(dueDate: Date | string | null): string | null {
    const startAt = this.deriveTaskStartAt(dueDate);
    if (!startAt) {
      return null;
    }

    return startAt.slice(0, 10);
  }

  private deriveDefaultEndAt(startAt: string): string {
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('startAt không hợp lệ');
    }

    return new Date(start.getTime() + 60 * 60 * 1000).toISOString();
  }

  private deriveDefaultAllDayEndDate(startDate: string): string {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('startDate không hợp lệ');
    }

    return new Date(start.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  private parseGoogleDateOrNull(value?: string | null): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private extractMeetUrl(event: GoogleCalendarEventResponse): string | null {
    return (
      event.hangoutLink ||
      event.conferenceData?.entryPoints?.find(
        (entry) => entry.entryPointType === 'video',
      )?.uri ||
      null
    );
  }

  private deriveTaskDueDateFromGoogleEvent(
    event: GoogleCalendarEventResponse,
  ): Date | null {
    const startDateTime = event.start?.dateTime;
    if (startDateTime) {
      const parsedDateTime = new Date(startDateTime);
      return Number.isNaN(parsedDateTime.getTime()) ? null : parsedDateTime;
    }

    const startDate = event.start?.date;
    if (!startDate) {
      return null;
    }

    const parsedDate = new Date(`${startDate}T00:00:00.000Z`);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  private mapGoogleEventToListItem(
    event: GoogleCalendarEventResponse,
    calendarId: string,
  ): GoogleCalendarEventListItem {
    const startAt = event.start?.dateTime || event.start?.date || null;
    const endAt = event.end?.dateTime || event.end?.date || null;
    const isAllDay = !event.start?.dateTime && Boolean(event.start?.date);

    return {
      eventId: event.id || '',
      etag: event.etag || null,
      updatedAt: event.updated || null,
      summary: event.summary || '(Untitled Event)',
      description: event.description || null,
      status: event.status || null,
      startAt,
      endAt,
      isAllDay,
      eventUrl: event.htmlLink || null,
      meetUrl: this.extractMeetUrl(event),
      location: event.location || null,
      attendees: (event.attendees || [])
        .filter((attendee) => Boolean(attendee.email))
        .map((attendee) => ({
          email: attendee.email!,
          displayName: attendee.displayName || null,
          optional: Boolean(attendee.optional),
          responseStatus: attendee.responseStatus || null,
          self: Boolean(attendee.self),
        })),
      recurrence: event.recurrence || [],
      calendarId,
    };
  }

  private applyGoogleEventToTask(
    task: Task,
    event: GoogleCalendarEventResponse,
    calendarId: string,
  ): void {
    if (event.summary?.trim()) {
      task.title = event.summary.trim();
    }

    if (event.description !== undefined) {
      task.description = event.description || null;
    }

    task.dueDate = this.deriveTaskDueDateFromGoogleEvent(event);
    task.googleEventId = event.id || task.googleEventId;
    task.googleCalendarId = calendarId;
    task.googleMeetUrl = this.extractMeetUrl(event);
    task.googleEventEtag = event.etag || null;
    task.googleEventUpdatedAt = this.parseGoogleDateOrNull(event.updated);
    task.googleLastPulledAt =
      this.parseGoogleDateOrNull(event.updated) || new Date();
  }

  private async pushTaskToGoogleEvent(
    account: GoogleAccount,
    accessToken: string,
    task: Task,
    remoteEvent: GoogleCalendarEventResponse,
    calendarId: string,
  ): Promise<GoogleCalendarEventResponse> {
    const payload: Record<string, unknown> = {
      summary: task.title,
      description: task.description || undefined,
    };

    if (task.dueDate) {
      const startAt = task.dueDate.toISOString();
      payload.start = {
        dateTime: startAt,
        timeZone: 'UTC',
      };
      payload.end = {
        dateTime: this.deriveDefaultEndAt(startAt),
        timeZone: 'UTC',
      };
    } else if (remoteEvent.start && remoteEvent.end) {
      payload.start = remoteEvent.start;
      payload.end = remoteEvent.end;
    }

    const updated = (await this.callGoogleApiWithRefresh(
      account,
      accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events/${encodeURIComponent(task.googleEventId || '')}?conferenceDataVersion=1`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(task.googleEventEtag
            ? {
                'If-Match': task.googleEventEtag,
              }
            : {}),
        },
        body: JSON.stringify(payload),
      },
    )) as GoogleCalendarEventResponse;

    return updated;
  }

  private parseJobPayload(payloadRaw: string): {
    taskId: string;
    calendarId?: string;
    createMeetLink?: boolean;
  } {
    try {
      return JSON.parse(payloadRaw) as {
        taskId: string;
        calendarId?: string;
        createMeetLink?: boolean;
      };
    } catch {
      throw new BadRequestException('Payload sync job không phải JSON hợp lệ');
    }
  }

  private nextRetryAt(attempt: number): Date {
    const baseMs = this.configService.get<number>('GOOGLE_SYNC_RETRY_BASE_MS', 300000);
    const maxMs = 6 * 60 * 60 * 1000;
    const delay = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)));
    return new Date(Date.now() + delay);
  }

  private getMaxAttempts(): number {
    const configured = this.configService.get<number>('GOOGLE_SYNC_MAX_ATTEMPTS', 5);
    return Math.min(Math.max(configured, 1), 20);
  }

  private getScopes(): string[] {
    const configured = this.configService.get<string>('GOOGLE_SCOPES', 'openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar');
    return configured.split(' ').filter(Boolean);
  }

  private getRedirectUri(redirectUri?: string): string {
    const configured = this.configService.get<string>('GOOGLE_REDIRECT_URI', '').trim();
    const fallbackFrontend = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');

    return (
      redirectUri?.trim() ||
      configured ||
      `${fallbackFrontend.replace(/\/$/, '')}/integrations/google/callback`
    );
  }

  private getRequiredConfig(name: string): string {
    const value = this.configService.get<string>(name, '').trim();
    if (!value) {
      throw new BadRequestException(
        `${name} chưa được cấu hình trong backend environment`,
      );
    }
    return value;
  }

  private decodeIdToken(idToken?: string): ParsedUserFromIdToken {
    if (!idToken) {
      return {};
    }

    const parts = idToken.split('.');
    if (parts.length < 2) {
      return {};
    }

    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as ParsedUserFromIdToken;
      return payload;
    } catch {
      return {};
    }
  }

  private async exchangeAuthorizationCode(
    code: string,
    redirectUri: string,
  ): Promise<GoogleTokenResponse> {
    const clientId = this.getRequiredConfig('GOOGLE_CLIENT_ID');
    const clientSecret = this.getRequiredConfig('GOOGLE_CLIENT_SECRET');

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const parsed = (await response.json()) as GoogleTokenResponse;

    if (!response.ok) {
      throw new BadRequestException(
        parsed.error_description || parsed.error || 'Google token exchange failed',
      );
    }

    return parsed;
  }

  private async refreshAccessToken(account: GoogleAccount): Promise<string> {
    if (!account.refreshToken) {
      throw new BadRequestException('Google refresh token không tồn tại');
    }

    const clientId = this.getRequiredConfig('GOOGLE_CLIENT_ID');
    const clientSecret = this.getRequiredConfig('GOOGLE_CLIENT_SECRET');

    const body = new URLSearchParams({
      refresh_token: account.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const parsed = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || !parsed.access_token) {
      throw new BadRequestException(
        parsed.error_description || parsed.error || 'Không thể refresh Google token',
      );
    }

    account.accessToken = parsed.access_token;
    if (parsed.expires_in) {
      account.tokenExpiresAt = new Date(Date.now() + parsed.expires_in * 1000);
    }

    await this.googleAccountsRepository.save(account);
    return parsed.access_token;
  }

  private async ensureValidAccessToken(account: GoogleAccount): Promise<string> {
    const expiresAt = account.tokenExpiresAt?.getTime() || 0;
    const stillValid = expiresAt > Date.now() + 60_000;

    if (stillValid && account.accessToken) {
      return account.accessToken;
    }

    return this.refreshAccessToken(account);
  }

  private async getActiveAccountOrThrow(userId: string): Promise<GoogleAccount> {
    const account = await this.googleAccountsRepository.findOne({
      where: { userId },
    });

    if (!account) {
      throw new BadRequestException('Bạn chưa kết nối Google account');
    }

    return account;
  }

  private async callGoogleApiWithRefresh(
    account: GoogleAccount,
    accessToken: string,
    endpoint: string,
    init: RequestInit,
  ): Promise<unknown> {
    const first = await fetch(endpoint, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (first.status !== 401) {
      const parsed = (await first.json()) as unknown;
      if (!first.ok) {
        throw new BadRequestException(this.extractErrorFromGoogleResponse(parsed));
      }
      return parsed;
    }

    const refreshedToken = await this.refreshAccessToken(account);
    const second = await fetch(endpoint, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${refreshedToken}`,
      },
    });

    const parsedSecond = (await second.json()) as unknown;
    if (!second.ok) {
      throw new BadRequestException(
        this.extractErrorFromGoogleResponse(parsedSecond),
      );
    }

    return parsedSecond;
  }

  private extractErrorFromGoogleResponse(response: unknown): string {
    if (!response || typeof response !== 'object') {
      return 'Google API request failed';
    }

    const maybeError = (response as { error?: { message?: string } }).error;
    if (maybeError?.message) {
      return maybeError.message;
    }

    return 'Google API request failed';
  }

  private async writeAuditLog(input: {
    userId?: string | null;
    workspaceId?: string | null;
    jobId?: string | null;
    action: string;
    status: string;
    message: string;
    requestPayload?: unknown;
    responsePayload?: unknown;
  }): Promise<void> {
    await this.auditLogsRepository.save(
      this.auditLogsRepository.create({
        userId: input.userId || null,
        workspaceId: input.workspaceId || null,
        jobId: input.jobId || null,
        provider: 'google',
        action: input.action,
        status: input.status,
        message: input.message,
        requestPayload:
          input.requestPayload === undefined
            ? null
            : JSON.stringify(input.requestPayload),
        responsePayload:
          input.responsePayload === undefined
            ? null
            : JSON.stringify(input.responsePayload),
      }),
    );
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
