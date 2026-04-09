import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../../api/auth.api";
import { googleIntegrationsApi } from "../../api/google-integrations.api";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { getErrorMessage } from "../../lib/errors";
import { useLocale } from "../../lib/locale";
import type { GoogleSyncJobStatus, User } from "../../types/api";

const GOOGLE_QUERY_ROOT = ["integrations", "google"] as const;

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function getGoogleStatusLabel(
  value: GoogleSyncJobStatus,
  t: (vi: string, en: string) => string,
): string {
  if (value === "pending") {
    return t("Chờ xử lý", "Pending");
  }

  if (value === "processing") {
    return t("Đang chạy", "Processing");
  }

  if (value === "retrying") {
    return t("Đang retry", "Retrying");
  }

  if (value === "completed") {
    return t("Hoàn tất", "Completed");
  }

  return t("Thất bại", "Failed");
}

function getGoogleEventTimeLabel(
  startAt: string | null,
  endAt: string | null,
  isAllDay: boolean,
  t: (vi: string, en: string) => string,
): string {
  if (isAllDay) {
    return t("Cả ngày", "All day");
  }

  if (!startAt) {
    return "-";
  }

  const startText = formatDateTime(startAt);
  if (!endAt) {
    return startText;
  }

  return `${startText} → ${formatDateTime(endAt)}`;
}

function ProfileForm({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();
  const { t } = useLocale();
  const pushToast = useToastStore((state) => state.pushToast);
  const [name, setName] = useState(user.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");

  const updateMutation = useMutation({
    mutationFn: () => authApi.updateProfile({ name, avatarUrl }),
    onSuccess: (nextUser) => {
      setUser(nextUser);
      pushToast({
        kind: "success",
        title: t("Đã lưu hồ sơ", "Profile saved"),
        message: t("Thông tin tài khoản đã được cập nhật.", "Account profile has been updated."),
      });
    },
  });

  const googleStatusQuery = useQuery({
    queryKey: [...GOOGLE_QUERY_ROOT, "status"],
    queryFn: () => googleIntegrationsApi.getStatus(),
    staleTime: 20_000,
  });

  const googleSyncJobsQuery = useQuery({
    queryKey: [...GOOGLE_QUERY_ROOT, "jobs"],
    queryFn: () => googleIntegrationsApi.listSyncJobs({ limit: 8 }),
    enabled: Boolean(googleStatusQuery.data?.connected),
  });

  const googleAuditLogsQuery = useQuery({
    queryKey: [...GOOGLE_QUERY_ROOT, "audit"],
    queryFn: () => googleIntegrationsApi.listAuditLogs(8),
    enabled: Boolean(googleStatusQuery.data?.connected),
  });

  const googleEventsQuery = useQuery({
    queryKey: [...GOOGLE_QUERY_ROOT, "events-preview"],
    queryFn: () =>
      googleIntegrationsApi.listCalendarEvents({
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        maxResults: 8,
      }),
    enabled: Boolean(googleStatusQuery.data?.connected),
    staleTime: 20_000,
  });

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/integrations/google/callback`;
      return googleIntegrationsApi.getOauthUrl(redirectUri);
    },
    onSuccess: (payload) => {
      window.location.assign(payload.url);
    },
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: () => googleIntegrationsApi.disconnect(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_ROOT });
      pushToast({
        kind: "success",
        title: t("Đã ngắt kết nối", "Disconnected"),
        message: t("Tài khoản Google đã được ngắt kết nối.", "Google account has been disconnected."),
      });
    },
  });

  const runSyncJobsMutation = useMutation({
    mutationFn: () => googleIntegrationsApi.runSyncJobs({ limit: 20 }),
    onSuccess: async (summary) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace"] }),
        queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_ROOT }),
      ]);

      pushToast({
        kind: "success",
        title: t("Đã chạy sync jobs", "Sync jobs executed"),
        message: t(
          `Processed ${summary.processed} jobs (done ${summary.completed}, retry ${summary.retrying}, failed ${summary.failed}).`,
          `Processed ${summary.processed} jobs (done ${summary.completed}, retry ${summary.retrying}, failed ${summary.failed}).`,
        ),
      });
    },
  });

  const topError =
    updateMutation.error ||
    googleStatusQuery.error ||
    googleSyncJobsQuery.error ||
    googleEventsQuery.error ||
    googleAuditLogsQuery.error ||
    connectGoogleMutation.error ||
    disconnectGoogleMutation.error ||
    runSyncJobsMutation.error;

  const googleStatus = googleStatusQuery.data;

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <p className="chip">{t("Hồ sơ", "Profile")}</p>
          <h1>{t("Cài đặt tài khoản", "Account Settings")}</h1>
        </div>
      </div>

      {topError ? <ErrorBanner message={getErrorMessage(topError)} /> : null}

      <Card>
        <h2 className="card-title">{t("Thông tin cơ bản", "Basic Information")}</h2>
        <div className="grid-form">
          <Input
            label={t("Tên", "Name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("Tên hiển thị", "Your display name")}
          />
          <Input
            label={t("URL ảnh đại diện", "Avatar URL")}
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>

        <Button loading={updateMutation.isPending} onClick={async () => updateMutation.mutateAsync()}>
          {t("Lưu hồ sơ", "Save Profile")}
        </Button>
      </Card>

      <Card>
        <h2 className="card-title">{t("Google Calendar & Meet", "Google Calendar & Meet")}</h2>

        {googleStatusQuery.isPending ? (
          <p className="muted-text">{t("Đang kiểm tra trạng thái kết nối...", "Checking integration status...")}</p>
        ) : null}

        {!googleStatusQuery.isPending && !googleStatus?.connected ? (
          <>
            <p className="muted-text">
              {t(
                "Kết nối Google để tạo event, sinh Meet link và sync task sang lịch.",
                "Connect Google to create events, generate Meet links, and sync tasks to calendar.",
              )}
            </p>
            <div className="inline-actions">
              <Button
                loading={connectGoogleMutation.isPending}
                onClick={async () => connectGoogleMutation.mutateAsync()}
              >
                {t("Kết nối Google", "Connect Google")}
              </Button>
            </div>
          </>
        ) : null}

        {googleStatus?.connected ? (
          <>
            <div className="google-status-grid">
              <p>
                <strong>{t("Email", "Email")}: </strong>
                {googleStatus.googleEmail || "-"}
              </p>
              <p>
                <strong>{t("Token hết hạn", "Token expires")}: </strong>
                {formatDateTime(googleStatus.tokenExpiresAt)}
              </p>
              <p>
                <strong>{t("Lần sync gần nhất", "Last sync")}: </strong>
                {formatDateTime(googleStatus.lastSyncAt)}
              </p>
            </div>

            <div className="inline-actions">
              <Button
                variant="secondary"
                loading={connectGoogleMutation.isPending}
                onClick={async () => connectGoogleMutation.mutateAsync()}
              >
                {t("Kết nối lại", "Reconnect")}
              </Button>
              <Button
                variant="ghost"
                loading={runSyncJobsMutation.isPending}
                onClick={async () => runSyncJobsMutation.mutateAsync()}
              >
                {t("Chạy sync jobs", "Run sync jobs")}
              </Button>
              <Button
                variant="danger"
                loading={disconnectGoogleMutation.isPending}
                onClick={async () => disconnectGoogleMutation.mutateAsync()}
              >
                {t("Ngắt kết nối", "Disconnect")}
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  await queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_ROOT });
                }}
              >
                {t("Làm mới trạng thái", "Refresh status")}
              </Button>
            </div>
          </>
        ) : null}
      </Card>

      {googleStatus?.connected ? (
        <Card>
          <h2 className="card-title">{t("Sync Jobs gần đây", "Recent Sync Jobs")}</h2>
          {googleSyncJobsQuery.isPending ? (
            <p className="muted-text">{t("Đang tải sync jobs...", "Loading sync jobs...")}</p>
          ) : null}

          {!googleSyncJobsQuery.isPending && (googleSyncJobsQuery.data ?? []).length === 0 ? (
            <p className="muted-text">{t("Chưa có sync job nào.", "No sync jobs yet.")}</p>
          ) : null}

          {(googleSyncJobsQuery.data ?? []).length > 0 ? (
            <ul className="integration-list">
              {(googleSyncJobsQuery.data ?? []).map((job) => (
                <li key={job.id}>
                  <div className="integration-list-row">
                    <p>
                      <strong>{job.task?.title || job.taskId || job.type}</strong>
                    </p>
                    <span className={`google-status-pill status-${job.status}`}>
                      {getGoogleStatusLabel(job.status, t)}
                    </span>
                  </div>
                  <p className="muted-text">
                    {t("Attempts", "Attempts")}: {job.attempts}/{job.maxAttempts}
                    {job.nextRetryAt
                      ? ` • ${t("Retry at", "Retry at")}: ${formatDateTime(job.nextRetryAt)}`
                      : ""}
                  </p>
                  {job.lastError ? <p className="muted-text">{job.lastError}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {googleStatus?.connected ? (
        <Card>
          <div className="integration-list-row">
            <h2 className="card-title">{t("Lịch 7 ngày tới", "Upcoming 7-day Agenda")}</h2>
            <Button
              size="sm"
              variant="ghost"
              loading={googleEventsQuery.isFetching}
              onClick={async () => {
                await googleEventsQuery.refetch();
              }}
            >
              {t("Làm mới", "Refresh")}
            </Button>
          </div>

          {googleEventsQuery.isPending ? (
            <p className="muted-text">{t("Đang tải agenda từ Google...", "Loading agenda from Google...")}</p>
          ) : null}

          {!googleEventsQuery.isPending && (googleEventsQuery.data?.items ?? []).length === 0 ? (
            <p className="muted-text">{t("Chưa có event nào trong 7 ngày tới.", "No events in the next 7 days.")}</p>
          ) : null}

          {(googleEventsQuery.data?.items ?? []).length > 0 ? (
            <ul className="integration-list">
              {(googleEventsQuery.data?.items ?? []).map((event) => {
                const statusClass =
                  event.status === "cancelled"
                    ? "status-failed"
                    : event.status === "tentative"
                      ? "status-processing"
                      : "status-success";

                return (
                  <li key={event.eventId}>
                    <div className="integration-list-row">
                      <p>
                        <strong>{event.summary}</strong>
                      </p>
                      <span className={`google-status-pill ${statusClass}`}>
                        {event.status || "confirmed"}
                      </span>
                    </div>
                    <p className="muted-text">
                      {getGoogleEventTimeLabel(event.startAt, event.endAt, event.isAllDay, t)}
                    </p>
                    <div className="inline-actions">
                      {event.eventUrl ? (
                        <a
                          href={event.eventUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="link-button link-button-sm"
                        >
                          {t("Mở Event", "Open Event")}
                        </a>
                      ) : null}
                      {event.meetUrl ? (
                        <a
                          href={event.meetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="link-button link-button-sm"
                        >
                          {t("Vào Meet", "Join Meet")}
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {googleStatus?.connected ? (
        <Card>
          <h2 className="card-title">{t("Audit Logs gần đây", "Recent Audit Logs")}</h2>
          {googleAuditLogsQuery.isPending ? (
            <p className="muted-text">{t("Đang tải audit logs...", "Loading audit logs...")}</p>
          ) : null}

          {!googleAuditLogsQuery.isPending && (googleAuditLogsQuery.data ?? []).length === 0 ? (
            <p className="muted-text">{t("Chưa có audit log nào.", "No audit logs yet.")}</p>
          ) : null}

          {(googleAuditLogsQuery.data ?? []).length > 0 ? (
            <ul className="integration-list">
              {(googleAuditLogsQuery.data ?? []).map((log) => (
                <li key={log.id}>
                  <div className="integration-list-row">
                    <p>
                      <strong>{log.action}</strong>
                    </p>
                    <span className={`google-status-pill status-${log.status}`}>{log.status}</span>
                  </div>
                  <p>{log.message}</p>
                  <p className="muted-text">{formatDateTime(log.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

export function ProfilePage() {
  const { user } = useAuthStore();
  const { t } = useLocale();

  if (!user) {
    return (
      <div className="page-stack">
        <Card>
          <h2 className="card-title">{t("Hồ sơ", "Profile")}</h2>
          <p className="muted-text">{t("Đang tải hồ sơ...", "Loading profile...")}</p>
        </Card>
      </div>
    );
  }

  return <ProfileForm key={user.id} user={user} />;
}
