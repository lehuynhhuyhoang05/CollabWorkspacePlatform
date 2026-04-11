import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type {
  ApiEnvelope,
  MessageThreadSummary,
  NotificationItem,
  User,
  WorkspaceActivity,
} from "../types/api";

interface SendMessageInput {
  recipientId: string;
  content: string;
  workspaceId?: string;
}

export const notificationsApi = {
  async listInbox(unreadOnly = false): Promise<NotificationItem[]> {
    return withApiError(
      http
        .get<ApiEnvelope<NotificationItem[]>>("/notifications", {
          params: unreadOnly ? { unreadOnly: "1" } : undefined,
        })
        .then((res) => unwrap(res.data)),
    );
  },

  async markAsRead(notificationId: string): Promise<NotificationItem> {
    return withApiError(
      http
        .patch<ApiEnvelope<NotificationItem>>(`/notifications/${notificationId}/read`)
        .then((res) => unwrap(res.data)),
    );
  },

  async markAllAsRead(): Promise<{ updated: number }> {
    return withApiError(
      http
        .patch<ApiEnvelope<{ updated: number }>>("/notifications/read-all")
        .then((res) => unwrap(res.data)),
    );
  },

  async listMessageThreads(): Promise<MessageThreadSummary[]> {
    return withApiError(
      http
        .get<ApiEnvelope<MessageThreadSummary[]>>("/notifications/messages/threads")
        .then((res) => unwrap(res.data)),
    );
  },

  async listMessageContacts(): Promise<Array<Pick<User, "id" | "name" | "email" | "avatarUrl">>> {
    return withApiError(
      http
        .get<ApiEnvelope<Array<Pick<User, "id" | "name" | "email" | "avatarUrl">>>>(
          "/notifications/messages/contacts",
        )
        .then((res) => unwrap(res.data)),
    );
  },

  async listMessageThread(counterpartId: string, limit = 120): Promise<NotificationItem[]> {
    return withApiError(
      http
        .get<ApiEnvelope<NotificationItem[]>>(`/notifications/messages/thread/${counterpartId}`, {
          params: { limit },
        })
        .then((res) => unwrap(res.data)),
    );
  },

  async markMessageThreadAsRead(counterpartId: string): Promise<{ updated: number }> {
    return withApiError(
      http
        .patch<ApiEnvelope<{ updated: number }>>(
          `/notifications/messages/thread/${counterpartId}/read`,
        )
        .then((res) => unwrap(res.data)),
    );
  },

  async sendMessage(input: SendMessageInput): Promise<NotificationItem> {
    return withApiError(
      http
        .post<ApiEnvelope<NotificationItem>>("/notifications/messages", input)
        .then((res) => unwrap(res.data)),
    );
  },

  async runDueSoonReminders(workspaceId?: string): Promise<{ created: number }> {
    return withApiError(
      http
        .post<ApiEnvelope<{ created: number }>>("/notifications/reminders/due-soon", undefined, {
          params: workspaceId ? { workspaceId } : undefined,
        })
        .then((res) => unwrap(res.data)),
    );
  },

  async listWorkspaceActivities(workspaceId: string, limit = 30): Promise<WorkspaceActivity[]> {
    return withApiError(
      http
        .get<ApiEnvelope<WorkspaceActivity[]>>(`/workspaces/${workspaceId}/activities`, {
          params: { limit },
        })
        .then((res) => unwrap(res.data)),
    );
  },
};
