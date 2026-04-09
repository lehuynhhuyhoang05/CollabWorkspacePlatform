import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type {
  ApiEnvelope,
  GoogleAuditLog,
  GoogleBidirectionalSyncSummary,
  GoogleCalendarEventItem,
  GoogleCalendarEventsPayload,
  GoogleCalendarEventResult,
  GoogleIntegrationStatus,
  GoogleOauthUrlPayload,
  GoogleSyncJob,
  GoogleSyncJobStatus,
} from "../types/api";

interface ExchangeGoogleCodeInput {
  code: string;
  redirectUri?: string;
}

interface CreateGoogleCalendarEventInput {
  taskId?: string;
  workspaceId?: string;
  summary?: string;
  description?: string;
  location?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  startDate?: string;
  endDate?: string;
  calendarId?: string;
  timezone?: string;
  createMeetLink?: boolean;
  attendees?: Array<{
    email: string;
    displayName?: string;
    optional?: boolean;
    responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
  }>;
  recurrence?: string[];
}

interface UpdateGoogleCalendarEventInput extends CreateGoogleCalendarEventInput {
  expectedEtag?: string;
}

interface UpdateGoogleCalendarEventRsvpInput {
  attendeeEmail: string;
  responseStatus: "needsAction" | "declined" | "tentative" | "accepted";
  calendarId?: string;
  expectedEtag?: string;
}

interface EnqueueTaskSyncInput {
  createMeetLink?: boolean;
  calendarId?: string;
}

interface ListSyncJobsInput {
  status?: GoogleSyncJobStatus;
  limit?: number;
}

interface RunSyncJobsInput {
  workspaceId?: string;
  limit?: number;
}

interface ListCalendarEventsInput {
  workspaceId?: string;
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  q?: string;
  maxResults?: number;
}

interface GetCalendarEventInput {
  calendarId?: string;
}

interface RunBidirectionalSyncInput {
  workspaceId?: string;
  limit?: number;
  conflictStrategy?: "mark" | "prefer_google" | "prefer_task";
}

export const googleIntegrationsApi = {
  async getOauthUrl(redirectUri?: string): Promise<GoogleOauthUrlPayload> {
    return withApiError(
      http
        .get<ApiEnvelope<GoogleOauthUrlPayload>>("/integrations/google/oauth/url", {
          params: redirectUri ? { redirectUri } : undefined,
        })
        .then((res) => unwrap(res.data)),
    );
  },

  async exchangeCode(input: ExchangeGoogleCodeInput): Promise<GoogleIntegrationStatus> {
    return withApiError(
      http
        .post<ApiEnvelope<GoogleIntegrationStatus>>("/integrations/google/oauth/exchange", input)
        .then((res) => unwrap(res.data)),
    );
  },

  async getStatus(): Promise<GoogleIntegrationStatus> {
    return withApiError(
      http
        .get<ApiEnvelope<GoogleIntegrationStatus>>("/integrations/google/status")
        .then((res) => unwrap(res.data)),
    );
  },

  async disconnect(): Promise<{ disconnected: boolean }> {
    return withApiError(
      http
        .delete<ApiEnvelope<{ disconnected: boolean }>>("/integrations/google/disconnect")
        .then((res) => unwrap(res.data)),
    );
  },

  async createCalendarEvent(input: CreateGoogleCalendarEventInput): Promise<GoogleCalendarEventResult> {
    return withApiError(
      http
        .post<ApiEnvelope<GoogleCalendarEventResult>>("/integrations/google/calendar/events", input)
        .then((res) => unwrap(res.data)),
    );
  },

  async listCalendarEvents(input?: ListCalendarEventsInput): Promise<GoogleCalendarEventsPayload> {
    return withApiError(
      http
        .get<ApiEnvelope<GoogleCalendarEventsPayload>>("/integrations/google/calendar/events", {
          params: {
            workspaceId: input?.workspaceId,
            calendarId: input?.calendarId,
            timeMin: input?.timeMin,
            timeMax: input?.timeMax,
            q: input?.q,
            maxResults: input?.maxResults,
          },
        })
        .then((res) => unwrap(res.data)),
    );
  },

  async getCalendarEvent(eventId: string, input?: GetCalendarEventInput): Promise<GoogleCalendarEventItem> {
    return withApiError(
      http
        .get<ApiEnvelope<GoogleCalendarEventItem>>(`/integrations/google/calendar/events/${eventId}`, {
          params: {
            calendarId: input?.calendarId,
          },
        })
        .then((res) => unwrap(res.data)),
    );
  },

  async updateCalendarEvent(
    eventId: string,
    input: UpdateGoogleCalendarEventInput,
  ): Promise<GoogleCalendarEventItem> {
    return withApiError(
      http
        .patch<ApiEnvelope<GoogleCalendarEventItem>>(
          `/integrations/google/calendar/events/${eventId}`,
          input,
        )
        .then((res) => unwrap(res.data)),
    );
  },

  async updateCalendarEventRsvp(
    eventId: string,
    input: UpdateGoogleCalendarEventRsvpInput,
  ): Promise<GoogleCalendarEventItem> {
    return withApiError(
      http
        .patch<ApiEnvelope<GoogleCalendarEventItem>>(
          `/integrations/google/calendar/events/${eventId}/rsvp`,
          input,
        )
        .then((res) => unwrap(res.data)),
    );
  },

  async enqueueTaskSync(taskId: string, input?: EnqueueTaskSyncInput): Promise<GoogleSyncJob> {
    return withApiError(
      http
        .post<ApiEnvelope<GoogleSyncJob>>(`/integrations/google/calendar/jobs/task/${taskId}`, input || {})
        .then((res) => unwrap(res.data)),
    );
  },

  async listSyncJobs(input?: ListSyncJobsInput): Promise<GoogleSyncJob[]> {
    return withApiError(
      http
        .get<ApiEnvelope<GoogleSyncJob[]>>("/integrations/google/calendar/jobs", {
          params: {
            status: input?.status,
            limit: input?.limit,
          },
        })
        .then((res) => unwrap(res.data)),
    );
  },

  async runSyncJobs(input?: RunSyncJobsInput): Promise<{
    processed: number;
    completed: number;
    failed: number;
    retrying: number;
  }> {
    return withApiError(
      http
        .patch<
          ApiEnvelope<{
            processed: number;
            completed: number;
            failed: number;
            retrying: number;
          }>
        >("/integrations/google/calendar/jobs/run", undefined, {
          params: {
            workspaceId: input?.workspaceId,
            limit: input?.limit,
          },
        })
        .then((res) => unwrap(res.data)),
    );
  },

  async runBidirectionalSync(
    input?: RunBidirectionalSyncInput,
  ): Promise<GoogleBidirectionalSyncSummary> {
    return withApiError(
      http
        .patch<ApiEnvelope<GoogleBidirectionalSyncSummary>>(
          "/integrations/google/calendar/sync/bidirectional",
          undefined,
          {
            params: {
              workspaceId: input?.workspaceId,
              limit: input?.limit,
              conflictStrategy: input?.conflictStrategy,
            },
          },
        )
        .then((res) => unwrap(res.data)),
    );
  },

  async listAuditLogs(limit = 20): Promise<GoogleAuditLog[]> {
    return withApiError(
      http
        .get<ApiEnvelope<GoogleAuditLog[]>>("/integrations/google/audit", {
          params: { limit },
        })
        .then((res) => unwrap(res.data)),
    );
  },
};
