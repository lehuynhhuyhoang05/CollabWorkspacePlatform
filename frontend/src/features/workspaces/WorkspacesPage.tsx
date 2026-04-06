import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspacesApi } from "../../api/workspaces.api";
import { getErrorMessage } from "../../lib/errors";
import { useLocale } from "../../lib/locale";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";
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

  const sortedWorkspaces = useMemo(
    () =>
      [...(listQuery.data ?? [])].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [listQuery.data],
  );

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
    <div className="page-stack">
      <div className="hero-panel">
        <p className="chip">{t("Trung tâm Workspace", "Workspace Hub")}</p>
        <h1>{t("Làm việc, triển khai, cộng tác trong một nơi.", "Build, ship, and collaborate in one place.")}</h1>
        <p>
          {t(
            "Backend đã chạy production. Hãy tạo workspace và tiếp tục với pages, blocks và cộng tác thời gian thực.",
            "Your backend is now live in production. Create a workspace and continue with pages, blocks, and collaborative editing.",
          )}
        </p>
        <div className="inline-actions">
          <Button variant="ghost" size="sm" onClick={() => setShowOnboarding((prev) => !prev)}>
            {showOnboarding ? t("Ẩn hướng dẫn", "Hide guide") : t("Xem hướng dẫn nhanh", "Quick guide")}
          </Button>
        </div>
      </div>

      {showOnboarding ? (
        <Card className="onboarding-card" role="region" aria-label={t("Hướng dẫn bắt đầu", "Getting started guide")}>
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

      {(listQuery.error || createMutation.error || updateMutation.error || deleteMutation.error) && (
        <ErrorBanner
          message={
            getErrorMessage(listQuery.error) ||
            getErrorMessage(createMutation.error) ||
            getErrorMessage(updateMutation.error) ||
            getErrorMessage(deleteMutation.error)
          }
        />
      )}

      <Card>
        <h2 className="card-title">{t("Tạo workspace", "Create Workspace")}</h2>
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

      <section className="workspace-grid">
        {sortedWorkspaces.length === 0 ? (
          <Card>
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
            <Card key={workspace.id} className="workspace-card">
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
                  <p>
                    {t("Tạo ngày", "Created")} {new Date(workspace.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="workspace-actions">
                <Link to={`/workspaces/${workspace.id}`} className="link-button">
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
