import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      pushToast({
        kind: "success",
        title: t("Đã gửi lời mời", "Invitation sent"),
        message: t("Thành viên đã được mời vào workspace.", "Member has been invited to workspace."),
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
      createPageMutation.error ||
      inviteMutation.error ||
      searchMutation.error ||
      updateRoleMutation.error ||
      removeMemberMutation.error,
    [
      workspaceQuery.error,
      treeQuery.error,
      membersQuery.error,
      createPageMutation.error,
      inviteMutation.error,
      searchMutation.error,
      updateRoleMutation.error,
      removeMemberMutation.error,
    ],
  );

  if (workspaceQuery.isPending || treeQuery.isPending || membersQuery.isPending) {
    return <Loader text={t("Đang tải chi tiết workspace...", "Loading workspace details...")} />;
  }

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <p className="chip">{t("Không gian", "Workspace")}</p>
          <h1>{workspaceQuery.data?.name}</h1>
        </div>
        <Link to="/workspaces" className="link-button">
          {t("Quay lại danh sách workspace", "Back to Workspaces")}
        </Link>
      </div>

      {topError ? <ErrorBanner message={getErrorMessage(topError)} /> : null}

      <div className="two-col-grid">
        <Card>
          <h2 className="card-title">{t("Trang nội dung", "Pages")}</h2>
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

        <Card>
          <h2 className="card-title">{t("Tìm kiếm trong workspace", "Search in Workspace")}</h2>
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

      <Card>
        <h2 className="card-title">{t("Thành viên", "Members")}</h2>
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
    </div>
  );
}
