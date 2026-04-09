import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../../api/notifications.api";
import { getErrorMessage } from "../../lib/errors";
import { useLocale } from "../../lib/locale";
import { useToastStore } from "../../store/toast.store";
import type { NotificationItem, NotificationType } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Loader } from "../../components/common/Loader";
import { ErrorBanner } from "../../components/common/ErrorBanner";

type InboxFilter = "all" | "unread";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function InboxPage() {
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const pushToast = useToastStore((state) => state.pushToast);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const inboxQuery = useQuery({
    queryKey: ["notifications", "inbox"],
    queryFn: () => notificationsApi.listInbox(false),
    staleTime: 15_000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      pushToast({
        kind: "success",
        title: t("Đã đánh dấu đã đọc", "Marked as read"),
        message: t(
          `Đã cập nhật ${result.updated} thông báo.`,
          `Updated ${result.updated} notifications.`,
        ),
      });
    },
  });

  const runRemindersMutation = useMutation({
    mutationFn: () => notificationsApi.runDueSoonReminders(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      pushToast({
        kind: "info",
        title: t("Đã tạo reminder", "Reminders generated"),
        message: t(
          `Đã tạo ${result.created} reminder cho task sắp đến hạn.`,
          `Created ${result.created} due-soon reminders.`,
        ),
      });
    },
  });

  const topError =
    inboxQuery.error ||
    markAsReadMutation.error ||
    markAllMutation.error ||
    runRemindersMutation.error;

  const notifications = useMemo(() => inboxQuery.data ?? [], [inboxQuery.data]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => !item.isRead);
    }

    return notifications;
  }, [filter, notifications]);

  const notificationTypeLabel = (type: NotificationType) => {
    if (type === "mention") return t("Nhắc đến", "Mention");
    if (type === "taskAssigned") return t("Giao việc", "Task assigned");
    return t("Nhắc deadline", "Deadline reminder");
  };

  if (inboxQuery.isPending) {
    return <Loader text={t("Đang tải inbox...", "Loading inbox...")} />;
  }

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <p className="chip">{t("Trung tâm thông báo", "Notification Center")}</p>
          <h1>{t("Inbox", "Inbox")}</h1>
        </div>
        <Link to="/workspaces" className="link-button">
          {t("Quay lại workspace", "Back to Workspaces")}
        </Link>
      </div>

      {topError ? <ErrorBanner message={getErrorMessage(topError)} /> : null}

      <Card>
        <div className="notification-toolbar">
          <div className="notification-filter-group" role="group" aria-label={t("Lọc inbox", "Inbox filter")}> 
            <button
              type="button"
              className={filter === "all" ? "comment-filter-btn active" : "comment-filter-btn"}
              onClick={() => setFilter("all")}
            >
              {t("Tất cả", "All")}
            </button>
            <button
              type="button"
              className={filter === "unread" ? "comment-filter-btn active" : "comment-filter-btn"}
              onClick={() => setFilter("unread")}
            >
              {t("Chưa đọc", "Unread")} ({unreadCount})
            </button>
          </div>

          <div className="inline-actions">
            <Button
              size="sm"
              variant="secondary"
              loading={runRemindersMutation.isPending}
              onClick={async () => {
                await runRemindersMutation.mutateAsync();
              }}
            >
              {t("Tạo reminder deadline", "Generate due reminders")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={markAllMutation.isPending}
              disabled={unreadCount === 0}
              onClick={async () => {
                if (unreadCount === 0) return;
                await markAllMutation.mutateAsync();
              }}
            >
              {t("Đánh dấu đọc tất cả", "Mark all as read")}
            </Button>
          </div>
        </div>

        {filteredNotifications.length === 0 ? (
          <p className="muted-text">
            {filter === "unread"
              ? t("Không có thông báo chưa đọc.", "No unread notifications.")
              : t("Chưa có thông báo nào.", "No notifications yet.")}
          </p>
        ) : (
          <ul className="notification-list">
            {filteredNotifications.map((notification: NotificationItem) => {
              const isProcessing =
                processingId === notification.id && markAsReadMutation.isPending;

              return (
                <li
                  key={notification.id}
                  className={notification.isRead ? "notification-item" : "notification-item unread"}
                >
                  <div className="notification-item-main">
                    <div className="notification-item-head">
                      <strong>{notification.title}</strong>
                      <span className="task-meta-pill">{notificationTypeLabel(notification.type)}</span>
                      {!notification.isRead ? (
                        <span className="comment-status-pill comment-status-pill-open">{t("Mới", "New")}</span>
                      ) : null}
                    </div>
                    <p>{notification.message}</p>
                    <p className="muted-text comment-meta">
                      {formatDateTime(notification.createdAt)}
                      {notification.creator?.name ? ` • ${notification.creator.name}` : ""}
                    </p>
                  </div>

                  <div className="notification-actions">
                    {notification.linkUrl ? (
                      <Link to={notification.linkUrl} className="link-button link-button-sm">
                        {t("Mở chi tiết", "Open")}
                      </Link>
                    ) : null}

                    {!notification.isRead ? (
                      <Button
                        size="sm"
                        loading={isProcessing}
                        onClick={async () => {
                          setProcessingId(notification.id);
                          try {
                            await markAsReadMutation.mutateAsync(notification.id);
                          } finally {
                            setProcessingId(null);
                          }
                        }}
                      >
                        {t("Đánh dấu đã đọc", "Mark read")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default InboxPage;
