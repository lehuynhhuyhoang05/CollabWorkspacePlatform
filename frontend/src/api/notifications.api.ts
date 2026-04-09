import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type {
  ApiEnvelope,
  NotificationItem,
  WorkspaceActivity,
} from "../types/api";

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
