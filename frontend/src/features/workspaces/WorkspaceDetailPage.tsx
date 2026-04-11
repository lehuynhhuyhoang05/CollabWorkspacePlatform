import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../../api/notifications.api";
import { pagesApi } from "../../api/pages.api";
import { searchApi } from "../../api/search.api";
import { workspacesApi } from "../../api/workspaces.api";
import { getErrorMessage } from "../../lib/errors";
import { useLocale } from "../../lib/locale";
import { useToastStore } from "../../store/toast.store";
import type { PageTreeNode, WorkspaceRole } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Loader } from "../../components/common/Loader";
import { ErrorBanner } from "../../components/common/ErrorBanner";

interface TranslateFn {
  (vi: string, en: string): string;
}

function PageTree({ nodes, t }: { nodes: PageTreeNode[]; t: TranslateFn }) {
  if (nodes.length === 0) {
    return <p className="muted-text">{t("Chưa có trang nào.", "No pages yet.")}</p>;
  }

  return (
    <ul className="tree-list">
      {nodes.map((node) => (
        <li key={node.id}>
          <Link to={`/pages/${node.id}`} className="tree-item">
            <span>{node.icon || "📄"}</span>
            <span>{node.title}</span>
          </Link>
          {node.children.length > 0 ? <PageTree nodes={node.children} t={t} /> : null}
        </li>
      ))}
    </ul>
  );
}

function countPageNodes(nodes: PageTreeNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countPageNodes(node.children), 0);
}

export function WorkspaceDetailPage() {
  const { workspaceId = "" } = useParams();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const pushToast = useToastStore((state) => state.pushToast);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageIcon, setNewPageIcon] = useState("📄");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("editor");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHint, setSearchHint] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showWorkspaceQr, setShowWorkspaceQr] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspacesApi.getById(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const treeQuery = useQuery({
    queryKey: ["workspace", workspaceId, "pages"],
    queryFn: () => pagesApi.getTree(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const membersQuery = useQuery({
    queryKey: ["workspace", workspaceId, "members"],
    queryFn: () => workspacesApi.listMembers(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const activitiesQuery = useQuery({
    queryKey: ["workspace", workspaceId, "activities"],
    queryFn: () => notificationsApi.listWorkspaceActivities(workspaceId, 30),
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
  });

  const workspaceInvitationsQuery = useQuery({
    queryKey: ["workspace", workspaceId, "invitations"],
    queryFn: () => workspacesApi.listWorkspaceInvitations(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
  });

  const createPageMutation = useMutation({
    mutationFn: () =>
      pagesApi.create(workspaceId, {
        title: newPageTitle || undefined,
        icon: newPageIcon || undefined,
      }),
    onSuccess: () => {
      setNewPageTitle("");
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "pages"] });
      pushToast({
        kind: "success",
        title: t("Đã tạo trang", "Page created"),
        message: t("Trang mới đã được thêm vào workspace.", "A new page was added to this workspace."),
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      workspacesApi.invite(workspaceId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      }),
    onSuccess: () => {
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "invitations"] });
      pushToast({
        kind: "success",
        title: t("Đã gửi lời mời", "Invitation sent"),
        message: t(
          "Lời mời đã được gửi. User cần chấp nhận để trở thành member.",
          "Invitation sent. The user must accept before becoming a member.",
        ),
      });
    },
  });

  const searchMutation = useMutation({
    mutationFn: () => searchApi.search(workspaceId, searchQuery.trim(), 20),
  });

  const updateRoleMutation = useMutation({
    mutationFn: (params: { userId: string; role: WorkspaceRole }) =>
      workspacesApi.updateMemberRole(workspaceId, params.userId, params.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "members"] });
      pushToast({
        kind: "success",
        title: t("Đã đổi vai trò", "Role updated"),
        message: t("Vai trò thành viên đã được cập nhật.", "Member role has been updated."),
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => workspacesApi.removeMember(workspaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "members"] });
      pushToast({
        kind: "success",
        title: t("Đã xóa thành viên", "Member removed"),
        message: t("Thành viên đã bị xóa khỏi workspace.", "Member has been removed from workspace."),
      });
    },
  });

  const topError = useMemo(
    () =>
      workspaceQuery.error ||
      treeQuery.error ||
      membersQuery.error ||
      activitiesQuery.error ||
      createPageMutation.error ||
      inviteMutation.error ||
      searchMutation.error ||
      updateRoleMutation.error ||
      removeMemberMutation.error ||
      workspaceInvitationsQuery.error,
    [
      workspaceQuery.error,
      treeQuery.error,
      membersQuery.error,
      activitiesQuery.error,
      createPageMutation.error,
      inviteMutation.error,
      searchMutation.error,
      updateRoleMutation.error,
      removeMemberMutation.error,
      workspaceInvitationsQuery.error,
    ],
  );

  const pendingWorkspaceInvitations = useMemo(
    () =>
      (workspaceInvitationsQuery.data ?? []).filter(
        (invitation) => invitation.status === "pending",
      ),
    [workspaceInvitationsQuery.data],
  );

  const workspaceShareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/workspaces/${workspaceId}`;
  }, [workspaceId]);

  const workspaceQrImageUrl = useMemo(() => {
    if (!workspaceShareUrl) {
      return "";
    }

    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(workspaceShareUrl)}`;
  }, [workspaceShareUrl]);

  const totalPages = useMemo(() => countPageNodes(treeQuery.data ?? []), [treeQuery.data]);
  const totalMembers = (membersQuery.data ?? []).length;
  const totalActivities = (activitiesQuery.data ?? []).length;

  if (workspaceQuery.isPending || treeQuery.isPending || membersQuery.isPending) {
    return <Loader text={t("Đang tải chi tiết workspace...", "Loading workspace details...")} />;
  }

  return (
    <div className="page-stack">
      <div className="hero-panel workspace-detail-hero">
        <div className="workspace-detail-head-row">
          <div>
            <p className="chip">{t("Không gian", "Workspace")}</p>
            <h1>{workspaceQuery.data?.name}</h1>
            <p className="muted-text">
              {t(
                "Quản lý pages, thành viên và hoạt động theo thời gian thực trong cùng một màn hình.",
                "Manage pages, members, and realtime workspace activity from one screen.",
              )}
            </p>
          </div>
          <div className="workspace-detail-actions">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowWorkspaceQr(true)}
            >
              {t("Share QR", "Share QR")}
            </Button>
            <Link to={`/workspaces/${workspaceId}/tasks`} className="link-button workspace-open-link">
              {t("Mở Tasks", "Open Tasks")}
            </Link>
            <Link to="/workspaces" className="link-button">
              {t("Quay lại danh sách workspace", "Back to Workspaces")}
            </Link>
          </div>
        </div>

        <div className="workspace-detail-metrics" role="list" aria-label={t("Tổng quan workspace", "Workspace overview")}>
          <article className="workspace-metric-card" role="listitem">
            <p>{t("Tổng page", "Total pages")}</p>
            <strong>{totalPages}</strong>
          </article>
          <article className="workspace-metric-card" role="listitem">
            <p>{t("Thành viên", "Members")}</p>
            <strong>{totalMembers}</strong>
          </article>
          <article className="workspace-metric-card" role="listitem">
            <p>{t("Activity gần đây", "Recent activities")}</p>
            <strong>{totalActivities}</strong>
          </article>
        </div>
      </div>

      {topError ? <ErrorBanner message={getErrorMessage(topError)} /> : null}

      <div className="two-col-grid workspace-detail-grid">
        <Card className="workspace-panel-card">
          <h2 className="card-title">{t("Trang nội dung", "Pages")}</h2>
          <p className="muted-text">
            {t(
              "Tạo page mới rồi mở để thêm block nội dung ngay trong workspace.",
              "Create a new page, then open it to start adding content blocks.",
            )}
          </p>
          <div className="grid-form">
            <Input
              label={t("Tiêu đề", "Title")}
              placeholder={t("Kế hoạch Sprint", "Sprint Plan")}
              value={newPageTitle}
              onChange={(event) => setNewPageTitle(event.target.value)}
            />
            <Input
              label={t("Biểu tượng", "Icon")}
              value={newPageIcon}
              maxLength={10}
              onChange={(event) => setNewPageIcon(event.target.value)}
            />
          </div>
          <Button
            loading={createPageMutation.isPending}
            disabled={!newPageTitle.trim()}
            onClick={async () => {
              if (!newPageTitle.trim()) return;
              await createPageMutation.mutateAsync();
            }}
          >
            {t("Tạo trang", "Create Page")}
          </Button>

          <div className="section-gap">
            <PageTree nodes={treeQuery.data ?? []} t={t} />
          </div>
        </Card>

        <Card className="workspace-panel-card">
          <h2 className="card-title">{t("Tìm kiếm trong workspace", "Search in Workspace")}</h2>
          <p className="muted-text">
            {t(
              "Tìm theo tiêu đề hoặc nội dung để mở đúng page nhanh hơn.",
              "Search by title or content to jump to the right page faster.",
            )}
          </p>
          <div className="search-row">
            <Input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                if (searchHint) setSearchHint("");
              }}
              placeholder={t("Tìm theo tiêu đề hoặc nội dung...", "Search title or content...")}
            />
            <Button
              variant="secondary"
              loading={searchMutation.isPending}
              onClick={async () => {
                if (searchQuery.trim().length < 2) {
                  setSearchHint(
                    t(
                      "Vui lòng nhập ít nhất 2 ký tự để tìm kiếm.",
                      "Please enter at least 2 characters to search.",
                    ),
                  );
                  return;
                }

                setSearchHint("");
                const result = await searchMutation.mutateAsync();
                if (result.length === 0) {
                  pushToast({
                    kind: "info",
                    title: t("Không có kết quả", "No result"),
                    message: t("Hãy thử từ khóa khác để tìm kiếm.", "Try another keyword for search."),
                  });
                }
              }}
            >
              {t("Tìm kiếm", "Search")}
            </Button>
          </div>

          {searchHint ? <p className="muted-text">{searchHint}</p> : null}

          <ul className="result-list">
            {searchMutation.data?.length === 0 && searchQuery.trim().length >= 2 ? (
              <li>
                <div className="empty-row">{t("Không có kết quả phù hợp.", "No matching result found.")}</div>
              </li>
            ) : null}

            {(searchMutation.data ?? []).map((item) => (
              <li key={`${item.pageId}-${item.matchType}`}>
                <Link to={`/pages/${item.pageId}`}>
                  <strong>{item.pageIcon || "📄"} {item.pageTitle}</strong>
                  <p>{item.snippet.replace(/\*\*/g, "")}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="workspace-members-card">
        <div className="integration-list-row">
          <h2 className="card-title">{t("Thành viên", "Members")}</h2>
          <span className="task-meta-pill">{totalMembers} {t("người", "members")}</span>
        </div>
        <div className="invite-row">
          <Input
            label={t("Mời bằng email", "Invite by email")}
            type="email"
            value={inviteEmail}
            placeholder="teammate@example.com"
            onChange={(event) => setInviteEmail(event.target.value)}
          />
          <label className="field-root">
            <span className="field-label">{t("Vai trò", "Role")}</span>
            <select
              className="field-input"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}
            >
              <option value="viewer">{t("Người xem", "Viewer")}</option>
              <option value="editor">{t("Biên tập", "Editor")}</option>
              <option value="owner">{t("Chủ sở hữu", "Owner")}</option>
            </select>
          </label>
          <Button
            loading={inviteMutation.isPending}
            disabled={!inviteEmail.trim()}
            onClick={async () => {
              if (!inviteEmail.trim()) return;
              await inviteMutation.mutateAsync();
            }}
          >
            {t("Mời", "Invite")}
          </Button>
        </div>

        <table className="data-table">
          <caption className="sr-only">{t("Danh sách thành viên workspace", "Workspace members list")}</caption>
          <thead>
            <tr>
              <th>{t("Tên", "Name")}</th>
              <th>Email</th>
              <th>{t("Vai trò", "Role")}</th>
              <th>{t("Hành động", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {(membersQuery.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="muted-text">{t("Chưa có thành viên nào.", "No members yet.")}</td>
              </tr>
            ) : null}

            {(membersQuery.data ?? []).map((member) => (
              <tr key={member.id}>
                <td>{member.user?.name || member.userId}</td>
                <td>{member.user?.email || "-"}</td>
                <td>
                  <select
                    className="inline-select"
                    value={member.role}
                    onChange={async (event) => {
                      const nextRole = event.target.value as WorkspaceRole;
                      const confirmed = window.confirm(
                        t(
                          "Bạn có chắc muốn đổi vai trò thành viên này?",
                          "Are you sure you want to change this member role?",
                        ),
                      );
                      if (!confirmed) return;

                      await updateRoleMutation.mutateAsync({
                        userId: member.userId,
                        role: nextRole,
                      });
                    }}
                  >
                    <option value="viewer">{t("người xem", "viewer")}</option>
                    <option value="editor">{t("biên tập", "editor")}</option>
                    <option value="owner">{t("chủ sở hữu", "owner")}</option>
                  </select>
                </td>
                <td>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={removingMemberId === member.userId && removeMemberMutation.isPending}
                    disabled={Boolean(removingMemberId && removingMemberId !== member.userId)}
                    onClick={async () => {
                      const confirmed = window.confirm(
                        t(
                          "Bạn có chắc muốn xóa thành viên này khỏi workspace?",
                          "Are you sure you want to remove this member from workspace?",
                        ),
                      );
                      if (!confirmed) return;

                      setRemovingMemberId(member.userId);
                      try {
                        await removeMemberMutation.mutateAsync(member.userId);
                      } finally {
                        setRemovingMemberId(null);
                      }
                    }}
                  >
                    {t("Xóa", "Remove")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showWorkspaceQr ? (
        <div
          className="workspace-qr-modal-backdrop"
          role="presentation"
          onClick={() => setShowWorkspaceQr(false)}
        >
          <section
            className="workspace-qr-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Chia sẻ workspace bằng QR", "Share workspace via QR")}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workspace-list-head">
              <h3 className="card-subtitle">{t("QR chia sẻ workspace", "Workspace share QR")}</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowWorkspaceQr(false)}
              >
                {t("Đóng", "Close")}
              </Button>
            </div>

            {workspaceQrImageUrl ? (
              <img
                className="workspace-qr-image"
                src={workspaceQrImageUrl}
                alt={t("Mã QR chia sẻ workspace", "Workspace share QR code")}
              />
            ) : null}

            <p className="muted-text">{workspaceShareUrl}</p>

            <div className="inline-actions">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  if (!workspaceShareUrl) return;
                  try {
                    await navigator.clipboard.writeText(workspaceShareUrl);
                    pushToast({
                      kind: "success",
                      title: t("Đã copy link", "Link copied"),
                      message: t(
                        "Link workspace đã được copy.",
                        "Workspace link has been copied.",
                      ),
                    });
                  } catch {
                    pushToast({
                      kind: "error",
                      title: t("Không thể copy", "Unable to copy"),
                      message: t(
                        "Trình duyệt không cho phép copy tự động. Bạn có thể copy thủ công từ ô link.",
                        "Browser blocked automatic copy. Please copy manually from the link text.",
                      ),
                    });
                  }
                }}
              >
                {t("Copy link", "Copy link")}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      <Card className="workspace-invitation-card">
        <div className="workspace-list-head">
          <h2 className="card-title">{t("Lời mời đã gửi", "Outgoing invitations")}</h2>
          <span className="task-meta-pill">
            {pendingWorkspaceInvitations.length} {t("đang chờ", "pending")}
          </span>
        </div>

        {workspaceInvitationsQuery.isPending ? (
          <p className="muted-text">{t("Đang tải lời mời...", "Loading invitations...")}</p>
        ) : null}

        {!workspaceInvitationsQuery.isPending && pendingWorkspaceInvitations.length === 0 ? (
          <p className="muted-text">
            {t(
              "Chưa có lời mời nào đang chờ phản hồi.",
              "No pending invitations for this workspace.",
            )}
          </p>
        ) : null}

        {pendingWorkspaceInvitations.length > 0 ? (
          <ul className="workspace-invitation-list">
            {pendingWorkspaceInvitations.map((invitation) => (
              <li key={invitation.id}>
                <div>
                  <p className="task-title">{invitation.invitee?.name || invitation.inviteeId}</p>
                  <p className="muted-text">
                    {invitation.invitee?.email || "-"} • {t("Vai trò", "Role")}: {invitation.role}
                  </p>
                </div>
                <span className="task-meta-pill">{new Date(invitation.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="workspace-activity-card">
        <div className="inline-actions">
          <h2 className="card-title">{t("Activity Feed", "Activity Feed")}</h2>
          <Button
            size="sm"
            variant="ghost"
            loading={activitiesQuery.isFetching}
            onClick={async () => {
              await activitiesQuery.refetch();
            }}
          >
            {t("Làm mới", "Refresh")}
          </Button>
        </div>

        {activitiesQuery.isPending ? (
          <p className="muted-text">{t("Đang tải activity...", "Loading activity...")}</p>
        ) : null}

        {!activitiesQuery.isPending && (activitiesQuery.data ?? []).length === 0 ? (
          <p className="muted-text">{t("Chưa có hoạt động nào gần đây.", "No recent activity yet.")}</p>
        ) : null}

        {(activitiesQuery.data ?? []).length > 0 ? (
          <ul className="workspace-activity-list">
            {(activitiesQuery.data ?? []).map((activity) => (
              <li key={activity.id}>
                <div>
                  <p>
                    <strong>{activity.actor?.name || activity.actorUserId}</strong>
                    {": "}
                    {activity.message}
                  </p>
                  <p className="muted-text comment-meta">{new Date(activity.createdAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
