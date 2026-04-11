import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../../api/notifications.api";
import { getErrorMessage } from "../../lib/errors";
import { useLocale } from "../../lib/locale";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";
import type { NotificationItem, NotificationType } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Loader } from "../../components/common/Loader";
import { ErrorBanner } from "../../components/common/ErrorBanner";

type InboxFilter = "all" | "unread";
type InboxTab = "notifications" | "messages";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const pushToast = useToastStore((state) => state.pushToast);
  const currentUser = useAuthStore((state) => state.user);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [quickRecipientId, setQuickRecipientId] = useState("");

  const activeTab: InboxTab = searchParams.get("tab") === "messages" ? "messages" : "notifications";
  const selectedThreadId = (searchParams.get("user") || "").trim();

  const updateRoute = (tab: InboxTab, userId?: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "messages") {
      next.set("tab", "messages");
    } else {
      next.delete("tab");
      next.delete("user");
    }

    if (tab === "messages") {
      if (userId) {
        next.set("user", userId);
      } else {
        next.delete("user");
      }
    }

    setSearchParams(next, { replace: true });
  };

  const inboxQuery = useQuery({
    queryKey: ["notifications", "inbox"],
    queryFn: () => notificationsApi.listInbox(false),
    staleTime: 15_000,
  });

  const messageThreadsQuery = useQuery({
    queryKey: ["notifications", "messages", "threads"],
    queryFn: () => notificationsApi.listMessageThreads(),
    staleTime: 8_000,
  });

  const messageContactsQuery = useQuery({
    queryKey: ["notifications", "messages", "contacts"],
    queryFn: () => notificationsApi.listMessageContacts(),
    staleTime: 60_000,
  });

  const messageThreadQuery = useQuery({
    queryKey: ["notifications", "messages", "thread", selectedThreadId],
    queryFn: () => notificationsApi.listMessageThread(selectedThreadId),
    enabled: Boolean(selectedThreadId),
    staleTime: 5_000,
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

  const markMessageThreadMutation = useMutation({
    mutationFn: (counterpartId: string) => notificationsApi.markMessageThreadAsRead(counterpartId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "messages", "threads"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (input: { recipientId: string; content: string; workspaceId?: string }) =>
      notificationsApi.sendMessage(input),
    onSuccess: async (_, variables) => {
      setMessageDraft("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications", "messages", "threads"] }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "messages", "thread", variables.recipientId],
        }),
        queryClient.invalidateQueries({ queryKey: ["notifications", "unread"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] }),
      ]);
    },
  });

  const topError =
    inboxQuery.error ||
    markAsReadMutation.error ||
    markAllMutation.error ||
    runRemindersMutation.error ||
    messageThreadsQuery.error ||
    messageContactsQuery.error ||
    messageThreadQuery.error ||
    sendMessageMutation.error ||
    markMessageThreadMutation.error;

  const notifications = useMemo(() => inboxQuery.data ?? [], [inboxQuery.data]);
  const systemNotifications = useMemo(
    () => notifications.filter((item) => item.type !== "directMessage"),
    [notifications],
  );

  const messageThreads = useMemo(() => messageThreadsQuery.data ?? [], [messageThreadsQuery.data]);
  const messageContacts = useMemo(() => messageContactsQuery.data ?? [], [messageContactsQuery.data]);

  const selectedThread = useMemo(
    () => messageThreads.find((thread) => thread.counterpartId === selectedThreadId) || null,
    [messageThreads, selectedThreadId],
  );

  const selectedThreadMessages = useMemo(
    () => messageThreadQuery.data ?? [],
    [messageThreadQuery.data],
  );

  const unreadCount = useMemo(
    () => systemNotifications.filter((item) => !item.isRead).length,
    [systemNotifications],
  );

  const unreadMessageCount = useMemo(
    () => messageThreads.reduce((sum, thread) => sum + thread.unreadCount, 0),
    [messageThreads],
  );

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return systemNotifications.filter((item) => !item.isRead);
    }

    return systemNotifications;
  }, [filter, systemNotifications]);

  useEffect(() => {
    if (!selectedThreadId || selectedThreadMessages.length === 0 || markMessageThreadMutation.isPending) {
      return;
    }

    const hasUnreadIncoming = selectedThreadMessages.some(
      (message) =>
        !message.isRead &&
        Boolean(message.createdBy) &&
        message.createdBy !== currentUser?.id,
    );

    if (!hasUnreadIncoming) {
      return;
    }

    markMessageThreadMutation.mutate(selectedThreadId);
  }, [
    currentUser?.id,
    markMessageThreadMutation,
    selectedThreadId,
    selectedThreadMessages,
  ]);

  const notificationTypeLabel = (type: NotificationType) => {
    if (type === "mention") return t("Nhắc đến", "Mention");
    if (type === "taskAssigned") return t("Giao việc", "Task assigned");
    if (type === "deadlineReminder") return t("Nhắc deadline", "Deadline reminder");
    if (type === "taskBlocked") return t("Task bị chặn", "Task blocked");
    if (type === "taskCompleted") return t("Task hoàn thành", "Task completed");
    if (type === "taskOverdue") return t("Task quá hạn", "Task overdue");
    if (type === "workspaceInvitation") return t("Lời mời workspace", "Workspace invitation");
    if (type === "workspaceInvitationResponse") {
      return t("Phản hồi lời mời", "Invitation response");
    }
    return t("Tin nhắn", "Message");
  };

  if (inboxQuery.isPending || messageThreadsQuery.isPending || messageContactsQuery.isPending) {
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
        <div className="notification-filter-group" role="tablist" aria-label={t("Phân loại inbox", "Inbox category")}> 
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "notifications"}
            className={activeTab === "notifications" ? "comment-filter-btn active" : "comment-filter-btn"}
            onClick={() => updateRoute("notifications")}
          >
            {t("Thông báo", "Notifications")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "messages"}
            className={activeTab === "messages" ? "comment-filter-btn active" : "comment-filter-btn"}
            onClick={() => updateRoute("messages", selectedThreadId || undefined)}
          >
            {t("Tin nhắn", "Messages")} ({unreadMessageCount})
          </button>
        </div>

        {activeTab === "notifications" ? (
          <>
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
                  {t("Quét task quan trọng", "Scan important task events")}
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
          </>
        ) : (
          <div className="inbox-messages-shell">
            <aside className="inbox-thread-pane">
              <div className="inbox-thread-compose">
                <label htmlFor="inbox-recipient-select" className="input-label">
                  {t("Bắt đầu hội thoại", "Start a conversation")}
                </label>
                <div className="inbox-thread-compose-row">
                  <select
                    id="inbox-recipient-select"
                    className="input"
                    value={quickRecipientId}
                    onChange={(event) => setQuickRecipientId(event.target.value)}
                  >
                    <option value="">{t("Chọn thành viên", "Choose a member")}</option>
                    {messageContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} ({contact.email})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!quickRecipientId}
                    onClick={() => updateRoute("messages", quickRecipientId)}
                  >
                    {t("Mở", "Open")}
                  </Button>
                </div>
              </div>

              <ul className="inbox-thread-list">
                {messageThreads.length === 0 ? (
                  <li className="muted-text">{t("Chưa có hội thoại nào.", "No conversations yet.")}</li>
                ) : (
                  messageThreads.map((thread) => {
                    const isActive = thread.counterpartId === selectedThreadId;
                    return (
                      <li key={thread.counterpartId}>
                        <button
                          type="button"
                          className={isActive ? "inbox-thread-item active" : "inbox-thread-item"}
                          onClick={() => updateRoute("messages", thread.counterpartId)}
                        >
                          <div className="inbox-thread-item-head">
                            <strong>{thread.counterpart?.name || t("Thành viên", "Member")}</strong>
                            {thread.unreadCount > 0 ? (
                              <span className="nav-badge">{thread.unreadCount}</span>
                            ) : null}
                          </div>
                          <p>{thread.lastMessage}</p>
                          <p className="muted-text comment-meta">{formatDateTime(thread.lastMessageAt)}</p>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </aside>

            <section className="inbox-chat-pane">
              {!selectedThreadId ? (
                <p className="muted-text">
                  {t(
                    "Chọn một hội thoại hoặc chọn thành viên để bắt đầu nhắn tin.",
                    "Select a conversation or pick a member to start messaging.",
                  )}
                </p>
              ) : messageThreadQuery.isPending ? (
                <Loader text={t("Đang tải hội thoại...", "Loading conversation...")} />
              ) : (
                <>
                  <div className="inbox-chat-head">
                    <strong>{selectedThread?.counterpart?.name || t("Hội thoại", "Conversation")}</strong>
                    <span className="muted-text">
                      {selectedThread?.counterpart?.email || t("Không rõ email", "Unknown email")}
                    </span>
                  </div>

                  <div className="inbox-chat-history">
                    {selectedThreadMessages.length === 0 ? (
                      <p className="muted-text">{t("Chưa có tin nhắn nào.", "No messages yet.")}</p>
                    ) : (
                      selectedThreadMessages.map((message) => {
                        const isMine = message.createdBy === currentUser?.id;
                        return (
                          <article
                            key={message.id}
                            className={isMine ? "chat-message-bubble mine" : "chat-message-bubble"}
                          >
                            <p>{message.message}</p>
                            <p className="muted-text comment-meta">{formatDateTime(message.createdAt)}</p>
                          </article>
                        );
                      })
                    )}
                  </div>

                  <form
                    className="inbox-chat-compose"
                    onSubmit={async (event) => {
                      event.preventDefault();

                      const content = messageDraft.trim();
                      if (!content || !selectedThreadId) return;

                      await sendMessageMutation.mutateAsync({
                        recipientId: selectedThreadId,
                        content,
                        workspaceId: selectedThread?.workspaceId || undefined,
                      });
                    }}
                  >
                    <textarea
                      className="message-compose-input"
                      rows={3}
                      placeholder={t("Nhập tin nhắn...", "Type your message...")}
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                    />
                    <Button
                      type="submit"
                      loading={sendMessageMutation.isPending}
                      disabled={!messageDraft.trim() || !selectedThreadId}
                    >
                      {t("Gửi", "Send")}
                    </Button>
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </Card>
    </div>
  );
}

export default InboxPage;
