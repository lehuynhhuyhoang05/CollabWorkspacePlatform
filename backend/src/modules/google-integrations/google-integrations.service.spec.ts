jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

import { BadRequestException } from '@nestjs/common';
import { WorkspaceRole } from '../workspaces/entities/workspace-member.entity';
import { GoogleIntegrationsService } from './google-integrations.service';

describe('GoogleIntegrationsService', () => {
  const originalFetch = global.fetch;

  let googleAccountsRepository: any;
  let syncJobsRepository: any;
  let auditLogsRepository: any;
  let tasksRepository: any;
  let membersRepository: any;
  let workspacesService: any;
  let configService: any;
  let service: GoogleIntegrationsService;

  const buildConfigService = (overrides?: Record<string, unknown>) => {
    const defaults: Record<string, unknown> = {
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3001/integrations/google/callback',
      GOOGLE_SCOPES:
        'openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar',
      GOOGLE_SYNC_MAX_ATTEMPTS: 5,
      GOOGLE_SYNC_RETRY_BASE_MS: 300000,
      FRONTEND_URL: 'http://localhost:3001',
    };

    const store = {
      ...defaults,
      ...(overrides || {}),
    };

    return {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (Object.prototype.hasOwnProperty.call(store, key)) {
          return store[key];
        }
        return defaultValue;
      }),
    };
  };

  beforeEach(() => {
    googleAccountsRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (data) => data),
      create: jest.fn((data) => data),
      delete: jest.fn(),
    };

    syncJobsRepository = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      save: jest.fn(async (data) => data),
      create: jest.fn((data) => data),
    };

    auditLogsRepository = {
      find: jest.fn(),
      save: jest.fn(async (data) => data),
      create: jest.fn((data) => data),
    };

    tasksRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (data) => data),
    };

    membersRepository = {
      findOne: jest.fn(),
    };

    workspacesService = {
      assertMember: jest.fn(),
      getMemberRole: jest.fn(),
    };

    configService = buildConfigService();

    service = new GoogleIntegrationsService(
      googleAccountsRepository,
      syncJobsRepository,
      auditLogsRepository,
      tasksRepository,
      membersRepository,
      workspacesService,
      configService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('runSyncJobs should mark job retrying with exponential retry timestamp and write audit', async () => {
    const job = {
      id: 'job-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      taskId: 'task-1',
      type: 'syncTaskEvent',
      payload: JSON.stringify({
        taskId: 'task-1',
        calendarId: 'primary',
        createMeetLink: true,
      }),
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      nextRetryAt: null,
      lastError: null,
      processedAt: null,
    };

    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([job]),
    };

    syncJobsRepository.createQueryBuilder.mockReturnValue(qb);
    googleAccountsRepository.findOne.mockResolvedValue(null);

    const summary = await service.runSyncJobs('user-1', 10, 'workspace-1');

    expect(summary).toEqual({
      processed: 1,
      completed: 0,
      failed: 0,
      retrying: 1,
    });

    expect(workspacesService.assertMember).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
    );

    const secondSaveArg = syncJobsRepository.save.mock.calls[1][0];
    expect(secondSaveArg.status).toBe('retrying');
    expect(secondSaveArg.attempts).toBe(1);
    expect(secondSaveArg.nextRetryAt).toBeInstanceOf(Date);
    expect(secondSaveArg.lastError).toContain(
      'Bạn chưa kết nối Google account',
    );

    const auditSaved = auditLogsRepository.save.mock.calls[0][0];
    expect(auditSaved.action).toBe('sync_job_run');
    expect(auditSaved.status).toBe('retrying');
  });

  it('exchangeCode should write failed audit when token exchange fails', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'bad authorization code',
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      service.exchangeCode(
        'user-1',
        'bad-code',
        'http://localhost:3001/integrations/google/callback',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );

    const auditSaved = auditLogsRepository.save.mock.calls[0][0];
    expect(auditSaved.action).toBe('oauth_exchange');
    expect(auditSaved.status).toBe('failed');
  });

  it('createCalendarEvent should refresh token after 401 and retry Google API call', async () => {
    const account = {
      id: 'ga-1',
      userId: 'user-1',
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      scopes: null,
      googleEmail: 'user@example.com',
      lastSyncAt: null,
    };

    const task = {
      id: 'task-1',
      workspaceId: 'workspace-1',
      title: 'Calendar Task',
      description: 'Sync task to Google',
      dueDate: new Date('2026-04-10T08:00:00.000Z'),
      assigneeId: 'user-1',
      googleEventId: null,
      googleCalendarId: null,
      googleMeetUrl: null,
    };

    googleAccountsRepository.findOne.mockResolvedValue(account);
    tasksRepository.findOne.mockResolvedValue(task);
    workspacesService.getMemberRole.mockResolvedValue(WorkspaceRole.OWNER);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: async () => ({ error: { message: 'Unauthorized' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'event-1',
          htmlLink: 'https://calendar.google.com/event?eid=event-1',
          conferenceData: {
            entryPoints: [
              {
                entryPointType: 'video',
                uri: 'https://meet.google.com/aaa-bbbb-ccc',
              },
            ],
          },
        }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await service.createCalendarEvent('user-1', {
      taskId: 'task-1',
      createMeetLink: true,
    });

    expect(result).toEqual({
      eventId: 'event-1',
      calendarId: 'primary',
      eventUrl: 'https://calendar.google.com/event?eid=event-1',
      meetUrl: 'https://meet.google.com/aaa-bbbb-ccc',
      syncedTaskId: 'task-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://oauth2.googleapis.com/token',
    );

    const retriedRequestOptions = fetchMock.mock.calls[2][1] as {
      headers?: Record<string, string>;
    };
    expect(retriedRequestOptions.headers?.Authorization).toBe(
      'Bearer new-access-token',
    );

    const savedTask = tasksRepository.save.mock.calls[0][0];
    expect(savedTask.googleEventId).toBe('event-1');
    expect(savedTask.googleCalendarId).toBe('primary');
    expect(savedTask.googleMeetUrl).toBe(
      'https://meet.google.com/aaa-bbbb-ccc',
    );

    const auditSaved = auditLogsRepository.save.mock.calls[0][0];
    expect(auditSaved.action).toBe('calendar_event_create');
    expect(auditSaved.status).toBe('success');
  });
});
