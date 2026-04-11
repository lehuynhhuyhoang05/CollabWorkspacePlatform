import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspacesApi } from "../../api/workspaces.api";
import { getErrorMessage } from "../../lib/errors";
import { useLocale } from "../../lib/locale";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";
import type { WorkspaceInvitationAction } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Loader } from "../../components/common/Loader";
import { ErrorBanner } from "../../components/common/ErrorBanner";

export function WorkspacesPage() {
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const user = useAuthStore((state) => state.user);
  const pushToast = useToastStore((state) => state.pushToast);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("WS");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);
  const [respondingInvitationId, setRespondingInvitationId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const onboardingStorageKey = `cloudcollab.onboarding.v2.${user?.id || "guest"}`;

  useEffect(() => {
    const seen = window.localStorage.getItem(onboardingStorageKey) === "1";
    setShowOnboarding(!seen);
  }, [onboardingStorageKey]);

  const dismissOnboarding = () => {
    window.localStorage.setItem(onboardingStorageKey, "1");
    setShowOnboarding(false);
  };

  const listQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspacesApi.list,
  });

  const incomingInvitationsQuery = useQuery({
    queryKey: ["workspaceInvitations", "incoming"],
    queryFn: workspacesApi.listIncomingInvitations,
  });

  const createMutation = useMutation({
    mutationFn: workspacesApi.create,
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      pushToast({
        kind: "success",
        title: t("Tạo thành công", "Created"),
        message: t("Workspace đã được tạo.", "Workspace has been created."),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: { workspaceId: string; nextName: string }) =>
      workspacesApi.update(params.workspaceId, { name: params.nextName }),
    onSuccess: () => {
      setEditingId(null);
      setEditingName("");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      pushToast({
        kind: "success",
        title: t("Đã cập nhật", "Updated"),
        message: t("Tên workspace đã được cập nhật.", "Workspace name has been updated."),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: workspacesApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      pushToast({
        kind: "success",
        title: t("Đã xóa", "Deleted"),
        message: t("Workspace đã được xóa.", "Workspace has been deleted."),
      });
    },
  });

  const respondInvitationMutation = useMutation({
    mutationFn: (params: { invitationId: string; action: WorkspaceInvitationAction }) =>
      workspacesApi.respondInvitation(params.invitationId, params.action),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workspaceInvitations", "incoming"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      pushToast({
        kind: variables.action === "accept" ? "success" : "info",
        title:
          variables.action === "accept"
            ? t("Đã tham gia workspace", "Joined workspace")
            : t("Đã từ chối lời mời", "Invitation declined"),
        message:
          variables.action === "accept"
            ? t(
                "Bạn đã được thêm vào workspace. Danh sách không gian đã cập nhật.",
                "You have been added to the workspace. Your workspace list is updated.",
              )
            : t(
                "Lời mời đã được từ chối.",
                "The invitation has been declined.",
              ),
      });
    },
  });

  const sortedWorkspaces = useMemo(
    () =>
      [...(listQuery.data ?? [])].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [listQuery.data],
  );

  const workspaceCount = sortedWorkspaces.length;
  const createdThisWeekCount = sortedWorkspaces.filter((workspace) => {
    const createdAt = new Date(workspace.createdAt).getTime();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return createdAt >= sevenDaysAgo;
  }).length;
  const latestWorkspace = sortedWorkspaces[0] ?? null;

  const onCreate = async () => {
    if (!name.trim()) return;
    await createMutation.mutateAsync({
      name: name.trim(),
      icon: icon.trim() || undefined,
    });
  };

  const onDelete = async (workspaceId: string) => {
    const confirmed = window.confirm(
      t(
        "Bạn có chắc muốn xóa workspace này? Hành động này không thể hoàn tác.",
        "Delete this workspace? This action cannot be undone.",
      ),
    );
    if (!confirmed) return;

    setDeletingWorkspaceId(workspaceId);
    try {
      await deleteMutation.mutateAsync(workspaceId);
    } finally {
      setDeletingWorkspaceId(null);
    }
  };

  if (listQuery.isPending) {
    return <Loader text={t("Đang tải danh sách workspace...", "Loading workspaces...")} />;
  }

  return (
    <div className="page-stack workspace-page-shell">
      <div className="hero-panel workspace-hero">
        <div className="workspace-hero-copy">
          <p className="chip">{t("Trung tâm Workspace", "Workspace Hub")}</p>
          <h1>{t("Làm việc, triển khai, cộng tác trong một nơi.", "Build, ship, and collaborate in one place.")}</h1>
          <p>
            {t(
              "Tạo không gian làm việc, quản lý page và mời thành viên trong một luồng rõ ràng, dễ kiểm soát.",
              "Create workspaces, organize pages, and invite teammates in one clean and easy-to-manage flow.",
            )}
          </p>
        </div>

        <div className="workspace-hero-metrics" role="list" aria-label={t("Tổng quan workspace", "Workspace overview")}> 
          <article className="workspace-metric-card" role="listitem">
            <p>{t("Tổng workspace", "Total workspaces")}</p>
            <strong>{workspaceCount}</strong>
          </article>
          <article className="workspace-metric-card" role="listitem">
            <p>{t("Tạo trong 7 ngày", "Created in 7 days")}</p>
            <strong>{createdThisWeekCount}</strong>
          </article>
          <article className="workspace-metric-card" role="listitem">
            <p>{t("Mới nhất", "Latest")}</p>
            <strong>{latestWorkspace?.name || t("Chưa có", "None")}</strong>
          </article>
        </div>

        <div className="inline-actions">
          <Button variant="ghost" size="sm" onClick={() => setShowOnboarding((prev) => !prev)}>
            {showOnboarding ? t("Ẩn hướng dẫn", "Hide guide") : t("Xem hướng dẫn nhanh", "Quick guide")}
          </Button>
        </div>
      </div>

      {showOnboarding ? (
        <Card className="onboarding-card workspace-guide-card" role="region" aria-label={t("Hướng dẫn bắt đầu", "Getting started guide")}>
          <div className="onboarding-head">
            <h2 className="card-title">{t("Bắt đầu trong 3 bước", "Start in 3 steps")}</h2>
            <Button variant="secondary" size="sm" onClick={dismissOnboarding}>
              {t("Đã hiểu", "Got it")}
            </Button>
          </div>
          <ol className="onboarding-list">
            <li>
              <strong>{t("Tạo workspace", "Create workspace")}</strong>
              <p>{t("Đặt tên và icon để tạo không gian làm việc.", "Set a name and icon for your team space.")}</p>
            </li>
            <li>
              <strong>{t("Tạo page và block", "Create page and blocks")}</strong>
              <p>{t("Vào workspace, tạo page rồi thêm block nội dung.", "Open workspace, create a page, then add blocks.")}</p>
            </li>
            <li>
              <strong>{t("Mời thành viên", "Invite members")}</strong>
              <p>{t("Mời editor/viewer để cộng tác và kiểm tra realtime.", "Invite editor/viewer and validate realtime collaboration.")}</p>
            </li>
          </ol>
        </Card>
      ) : null}

      {(
        listQuery.error ||
        createMutation.error ||
        updateMutation.error ||
        deleteMutation.error ||
        incomingInvitationsQuery.error ||
        respondInvitationMutation.error
      ) && (
        <ErrorBanner
          message={
            getErrorMessage(listQuery.error) ||
            getErrorMessage(createMutation.error) ||
            getErrorMessage(updateMutation.error) ||
            getErrorMessage(deleteMutation.error) ||
            getErrorMessage(incomingInvitationsQuery.error) ||
            getErrorMessage(respondInvitationMutation.error)
          }
        />
      )}

      <Card className="workspace-invitation-card">
        <div className="workspace-list-head">
          <h2 className="card-title">{t("Lời mời chờ phản hồi", "Pending invitations")}</h2>
          <span className="task-meta-pill">
            {(incomingInvitationsQuery.data ?? []).length} {t("lời mời", "invites")}
          </span>
        </div>

        {incomingInvitationsQuery.isPending ? (
          <p className="muted-text">{t("Đang tải lời mời...", "Loading invitations...")}</p>
        ) : null}

        {!incomingInvitationsQuery.isPending && (incomingInvitationsQuery.data ?? []).length === 0 ? (
          <p className="muted-text">
            {t(
              "Hiện chưa có lời mời workspace nào cần phản hồi.",
              "There are no workspace invitations awaiting your response.",
            )}
          </p>
        ) : null}

        {(incomingInvitationsQuery.data ?? []).length > 0 ? (
          <ul className="workspace-invitation-list">
            {(incomingInvitationsQuery.data ?? []).map((invitation) => (
              <li key={invitation.id}>
                <div>
                  <p className="task-title">{invitation.workspace?.name || invitation.workspaceId}</p>
                  <p className="muted-text">
                    {t("Mời bởi", "Invited by")} {invitation.inviter?.name || invitation.inviterId} • {t("Vai trò", "Role")} {invitation.role}
                  </p>
                </div>

                <div className="inline-actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={
                      respondingInvitationId === invitation.id &&
                      respondInvitationMutation.isPending
                    }
                    disabled={Boolean(respondingInvitationId && respondingInvitationId !== invitation.id)}
                    onClick={async () => {
                      setRespondingInvitationId(invitation.id);
                      try {
                        await respondInvitationMutation.mutateAsync({
                          invitationId: invitation.id,
                          action: "accept",
                        });
                      } finally {
                        setRespondingInvitationId(null);
                      }
                    }}
                  >
                    {t("Chấp nhận", "Accept")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={
                      respondingInvitationId === invitation.id &&
                      respondInvitationMutation.isPending
                    }
                    disabled={Boolean(respondingInvitationId && respondingInvitationId !== invitation.id)}
                    onClick={async () => {
                      setRespondingInvitationId(invitation.id);
                      try {
                        await respondInvitationMutation.mutateAsync({
                          invitationId: invitation.id,
                          action: "refuse",
                        });
                      } finally {
                        setRespondingInvitationId(null);
                      }
                    }}
                  >
                    {t("Từ chối", "Decline")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <div className="workspace-hub-grid">
        <Card className="workspace-create-card">
          <h2 className="card-title">{t("Tạo workspace", "Create Workspace")}</h2>
          <p className="muted-text">
            {t(
              "Đặt tên ngắn gọn, dễ nhớ. Bạn có thể đổi tên hoặc cập nhật sau.",
              "Use a short, memorable name. You can rename and update later.",
            )}
          </p>
          <div className="grid-form">
            <Input
              label={t("Tên workspace", "Workspace Name")}
              placeholder={t("Không gian nhóm Cloud", "Cloud Team Space")}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              label={t("Biểu tượng", "Icon")}
              placeholder="WS"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              maxLength={10}
            />
          </div>
          <Button onClick={onCreate} loading={createMutation.isPending} disabled={!name.trim()}>
            {t("Tạo workspace", "Create Workspace")}
          </Button>
        </Card>

        <Card className="workspace-insight-card">
          <h3 className="card-subtitle">{t("Tiến độ nhanh", "Quick progress")}</h3>
          <ul className="workspace-insight-list">
            <li>
              <span>{t("Tổng workspace", "Total workspaces")}</span>
              <strong>{workspaceCount}</strong>
            </li>
            <li>
              <span>{t("Tạo tuần này", "Created this week")}</span>
              <strong>{createdThisWeekCount}</strong>
            </li>
            <li>
              <span>{t("Workspace mới nhất", "Newest workspace")}</span>
              <strong>{latestWorkspace?.name || t("Chưa có", "None")}</strong>
            </li>
          </ul>
          <p className="muted-text">
            {t(
              "Mẹo: tạo workspace theo team hoặc dự án để dễ phân quyền và theo dõi tiến độ.",
              "Tip: create workspaces by team or project for easier permissions and progress tracking.",
            )}
          </p>
        </Card>
      </div>

      <section className="workspace-list-section">
        <div className="workspace-list-head">
          <h2 className="card-title">{t("Danh sách workspace", "Workspace list")}</h2>
          <span className="task-meta-pill">
            {workspaceCount} {t("workspace", "workspace")}
          </span>
        </div>
      </section>

      <section className="workspace-grid">
        {sortedWorkspaces.length === 0 ? (
          <Card className="workspace-empty-card">
            <h3>{t("Chưa có workspace nào", "No workspaces yet")}</h3>
            <p className="muted-text">
              {t(
                "Hãy tạo workspace đầu tiên để bắt đầu pages, blocks và cộng tác.",
                "Create your first workspace to start pages, blocks, and collaboration.",
              )}
            </p>
          </Card>
        ) : null}

        {sortedWorkspaces.map((workspace) => {
          const isEditing = editingId === workspace.id;

          return (
            <Card key={workspace.id} className="workspace-card workspace-card-elevated">
              <div className="workspace-card-head">
                <span className="workspace-icon">{workspace.icon || "📁"}</span>
                <div>
                  {isEditing ? (
                    <Input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      aria-label={t("Chỉnh sửa tên workspace", "Edit workspace name")}
                    />
                  ) : (
                    <h3>{workspace.name}</h3>
                  )}
                  <p>{t("Tạo ngày", "Created")} {new Date(workspace.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="workspace-card-meta">
                <span className="task-meta-pill">{t("Đang hoạt động", "Active")}</span>
                <span className="task-meta-pill">ID: {workspace.id.slice(0, 8)}</span>
              </div>

              <div className="workspace-actions">
                <Link to={`/workspaces/${workspace.id}`} className="link-button workspace-open-link">
                  {t("Mở", "Open")}
                </Link>

                {isEditing ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={updateMutation.isPending}
                      disabled={!editingName.trim()}
                      onClick={async () => {
                        if (!editingName.trim()) return;
                        await updateMutation.mutateAsync({
                          workspaceId: workspace.id,
                          nextName: editingName.trim(),
                        });
                      }}
                    >
                      {t("Lưu", "Save")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(null);
                        setEditingName("");
                      }}
                    >
                      {t("Hủy", "Cancel")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(workspace.id);
                        setEditingName(workspace.name);
                      }}
                    >
                      {t("Đổi tên", "Rename")}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={deletingWorkspaceId === workspace.id && deleteMutation.isPending}
                      disabled={Boolean(deletingWorkspaceId && deletingWorkspaceId !== workspace.id)}
                      onClick={async () => {
                        await onDelete(workspace.id);
                      }}
                    >
                      {t("Xóa", "Delete")}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
