import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { blocksApi } from "../../api/blocks.api";
import { commentsApi } from "../../api/comments.api";
import { pagesApi } from "../../api/pages.api";
import { shareApi } from "../../api/share.api";
import { storageApi } from "../../api/storage.api";
import { env } from "../../lib/env";
import { getErrorMessage } from "../../lib/errors";
import { useLocale } from "../../lib/locale";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";
import type { Block } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Loader } from "../../components/common/Loader";
import { ErrorBanner } from "../../components/common/ErrorBanner";

interface PresenceUser {
  userId: string;
  userName: string;
  color: string;
}

const BLOCK_TYPES = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulletList",
  "orderedList",
  "taskList",
  "codeBlock",
  "image",
  "divider",
  "quote",
  "table",
] as const;

type PageDetailTab = "content" | "comments" | "share-files";

const PAGE_DETAIL_TABS: Array<{ id: PageDetailTab; vi: string; en: string }> = [
  { id: "content", vi: "Nội dung", en: "Content" },
  { id: "comments", vi: "Bình luận", en: "Comments" },
  { id: "share-files", vi: "Chia sẻ/Tệp", en: "Share/Files" },
];

function toEditableText(content: string | null): string {
  if (!content) return "";

  try {
    const parsed = JSON.parse(content) as { text?: string; content?: Array<{ text?: string }> };
    if (parsed.text) return parsed.text;
    if (Array.isArray(parsed.content)) {
      return parsed.content
        .map((item) => item.text || "")
        .join(" ")
        .trim();
    }
  } catch {
    return content;
  }

  return content;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PageDetailPage() {
  const { pageId = "" } = useParams();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const pushToast = useToastStore((state) => state.pushToast);
  const { accessToken } = useAuthStore();
  const [titleDraftMap, setTitleDraftMap] = useState<Record<string, string>>({});
  const [iconDraftMap, setIconDraftMap] = useState<Record<string, string>>({});
  const [blockType, setBlockType] = useState<(typeof BLOCK_TYPES)[number]>("paragraph");
  const [blockContent, setBlockContent] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadedObjectName, setUploadedObjectName] = useState("");
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [draftMap, setDraftMap] = useState<Record<string, string>>({});
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PageDetailTab>("content");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const blockTypeLabelMap: Record<string, string> = {
    paragraph: t("Đoạn văn", "Paragraph"),
    heading1: t("Tiêu đề 1", "Heading 1"),
    heading2: t("Tiêu đề 2", "Heading 2"),
    heading3: t("Tiêu đề 3", "Heading 3"),
    bulletList: t("Danh sách chấm", "Bullet list"),
    orderedList: t("Danh sách số", "Ordered list"),
    taskList: t("Danh sách công việc", "Task list"),
    codeBlock: t("Khối mã", "Code block"),
    image: t("Hình ảnh", "Image"),
    divider: t("Đường phân cách", "Divider"),
    quote: t("Trích dẫn", "Quote"),
    table: t("Bảng", "Table"),
  };

  const getBlockTypeLabel = (type: string) => blockTypeLabelMap[type] || type;

  const focusTab = (index: number) => {
    const tab = tabRefs.current[index];
    if (tab) {
      tab.focus();
    }
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % PAGE_DETAIL_TABS.length;
      setActiveTab(PAGE_DETAIL_TABS[nextIndex].id);
      focusTab(nextIndex);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const previousIndex = (currentIndex - 1 + PAGE_DETAIL_TABS.length) % PAGE_DETAIL_TABS.length;
      setActiveTab(PAGE_DETAIL_TABS[previousIndex].id);
      focusTab(previousIndex);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveTab(PAGE_DETAIL_TABS[0].id);
      focusTab(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const lastIndex = PAGE_DETAIL_TABS.length - 1;
      setActiveTab(PAGE_DETAIL_TABS[lastIndex].id);
      focusTab(lastIndex);
    }
  };

  const pageQuery = useQuery({
    queryKey: ["page", pageId],
    queryFn: () => pagesApi.getById(pageId),
    enabled: Boolean(pageId),
  });

  const blocksQuery = useQuery({
    queryKey: ["page", pageId, "blocks"],
    queryFn: () => blocksApi.list(pageId),
    enabled: Boolean(pageId),
  });

  const commentsQuery = useQuery({
    queryKey: ["block", selectedBlockId, "comments"],
    queryFn: () => commentsApi.list(selectedBlockId || ""),
    enabled: Boolean(selectedBlockId),
  });

  const titleDraft = titleDraftMap[pageId] ?? pageQuery.data?.title ?? "";
  const iconDraft = iconDraftMap[pageId] ?? pageQuery.data?.icon ?? "📄";

  useEffect(() => {
    if (!accessToken || !pageId) return;

    const apiOrigin = new URL(env.apiBaseUrl).origin;
    const socket: Socket = io(`${apiOrigin}/collaboration`, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket.emit("join-page", { pageId });
    });

    socket.on("room-users", (users: PresenceUser[]) => {
      setPresenceUsers(users);
    });

    socket.on("user-joined", (user: PresenceUser) => {
      setPresenceUsers((prev) => {
        if (prev.find((item) => item.userId === user.userId)) return prev;
        return [...prev, user];
      });
    });

    socket.on("user-left", (payload: { userId: string }) => {
      setPresenceUsers((prev) => prev.filter((item) => item.userId !== payload.userId));
    });

    socket.on("block-updated", () => {
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "blocks"] });
    });

    socket.on("block-created", () => {
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "blocks"] });
    });

    socket.on("block-deleted", () => {
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "blocks"] });
    });

    return () => {
      socket.emit("leave-page", { pageId });
      socket.disconnect();
    };
  }, [accessToken, pageId, queryClient]);

  const updatePageMutation = useMutation({
    mutationFn: () => pagesApi.update(pageId, { title: titleDraft, icon: iconDraft }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page", pageId] });
      pushToast({
        kind: "success",
        title: t("Đã lưu", "Saved"),
        message: t("Thông tin trang đã được cập nhật.", "Page metadata has been updated."),
      });
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: () => blocksApi.create(pageId, { type: blockType, content: blockContent }),
    onSuccess: () => {
      setBlockContent("");
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "blocks"] });
      queryClient.invalidateQueries({ queryKey: ["page", pageId] });
      pushToast({
        kind: "success",
        title: t("Đã thêm block", "Block added"),
        message: t("Block mới đã được tạo thành công.", "A new block has been created."),
      });
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: (params: { blockId: string; content: string }) =>
      blocksApi.update(params.blockId, { content: params.content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "blocks"] });
      pushToast({
        kind: "success",
        title: t("Đã lưu block", "Block saved"),
        message: t("Nội dung block đã được cập nhật.", "Block content has been updated."),
      });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => blocksApi.remove(blockId),
    onSuccess: () => {
      setSelectedBlockId(null);
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "blocks"] });
      pushToast({
        kind: "success",
        title: t("Đã xóa block", "Block deleted"),
        message: t("Block đã được xóa khỏi trang.", "The block has been removed from page."),
      });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: () => commentsApi.create(selectedBlockId || "", commentContent),
    onSuccess: () => {
      setCommentContent("");
      queryClient.invalidateQueries({ queryKey: ["block", selectedBlockId, "comments"] });
      pushToast({
        kind: "success",
        title: t("Đã thêm bình luận", "Comment added"),
        message: t("Bình luận đã được thêm thành công.", "Comment has been added."),
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.remove(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block", selectedBlockId, "comments"] });
      pushToast({
        kind: "success",
        title: t("Đã xóa bình luận", "Comment removed"),
        message: t("Bình luận đã được xóa.", "Comment has been removed."),
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: () => storageApi.upload(uploadFile as File),
    onSuccess: (result) => {
      setUploadedObjectName(result.objectName);
      setBlockContent(result.url);
      pushToast({
        kind: "success",
        title: t("Tải tệp thành công", "Upload successful"),
        message: t("Bạn có thể dùng URL này để tạo block image.", "You can use this URL for an image block."),
      });
    },
  });

  const deleteUploadMutation = useMutation({
    mutationFn: () => storageApi.remove(uploadedObjectName),
    onSuccess: () => {
      setUploadedObjectName("");
      pushToast({
        kind: "success",
        title: t("Đã xóa tệp", "File deleted"),
        message: t("Tệp đã tải lên đã được xóa khỏi storage.", "Uploaded file has been deleted from storage."),
      });
    },
  });

  const shareMutation = useMutation({
    mutationFn: () => shareApi.create(pageId, "view"),
    onSuccess: (payload) => {
      const url = `${window.location.origin}/share/${payload.token}`;
      setShareUrl(url);
      pushToast({
        kind: "success",
        title: t("Đã tạo link chia sẻ", "Share link ready"),
        message: t("Bạn có thể sao chép và gửi link ngay.", "You can copy and send the link now."),
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => pagesApi.exportMarkdown(pageId),
    onSuccess: (blob) => {
      const filename = `page-${pageId}.md`;
      downloadBlob(filename, blob);
      pushToast({
        kind: "success",
        title: t("Đã xuất tệp", "Export complete"),
        message: t("File markdown đã được tải xuống.", "Markdown file has been downloaded."),
      });
    },
  });

  const topError = useMemo(
    () =>
      pageQuery.error ||
      blocksQuery.error ||
      commentsQuery.error ||
      createBlockMutation.error ||
      updateBlockMutation.error ||
      deleteBlockMutation.error ||
      createCommentMutation.error ||
      deleteCommentMutation.error ||
      shareMutation.error ||
      uploadMutation.error ||
      deleteUploadMutation.error ||
      updatePageMutation.error ||
      exportMutation.error,
    [
      pageQuery.error,
      blocksQuery.error,
      commentsQuery.error,
      createBlockMutation.error,
      updateBlockMutation.error,
      deleteBlockMutation.error,
      createCommentMutation.error,
      deleteCommentMutation.error,
      shareMutation.error,
      uploadMutation.error,
      deleteUploadMutation.error,
      updatePageMutation.error,
      exportMutation.error,
    ],
  );

  useEffect(() => {
    const nextBlocks = blocksQuery.data ?? [];

    if (nextBlocks.length === 0) {
      if (selectedBlockId !== null) {
        setSelectedBlockId(null);
      }
      return;
    }

    if (!selectedBlockId || !nextBlocks.some((block) => block.id === selectedBlockId)) {
      setSelectedBlockId(nextBlocks[0].id);
    }
  }, [blocksQuery.data, selectedBlockId]);

  if (pageQuery.isPending || blocksQuery.isPending) {
    return <Loader text={t("Đang tải trang...", "Loading page...")} />;
  }

  const blocks = blocksQuery.data || [];
  const selectedBlock = blocks.find((block) => block.id === selectedBlockId) || null;

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <p className="chip">{t("Trình chỉnh sửa trang", "Page Editor")}</p>
          <h1>{pageQuery.data?.title || t("Chưa có tiêu đề", "Untitled")}</h1>
        </div>
        <div className="presence-wrap">
          {presenceUsers.map((user) => (
            <span key={user.userId} className="presence-pill" style={{ borderColor: user.color }}>
              <i style={{ backgroundColor: user.color }} />
              {user.userName}
            </span>
          ))}
          <Link to={`/workspaces/${pageQuery.data?.workspaceId || ""}`} className="link-button">
            {t("Quay lại workspace", "Back to Workspace")}
          </Link>
        </div>
      </div>

      {topError ? <ErrorBanner message={getErrorMessage(topError)} /> : null}

      <section className="tab-shell" aria-label={t("Điều hướng trang", "Page navigation")}
      >
        <div className="tab-strip" role="tablist" aria-label={t("Khu vực thao tác", "Work areas")}>
          {PAGE_DETAIL_TABS.map((tab, index) => (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              id={`page-tab-${tab.id}`}
              type="button"
              role="tab"
              className={activeTab === tab.id ? "tab-btn active" : "tab-btn"}
              aria-selected={activeTab === tab.id}
              aria-controls={`page-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {t(tab.vi, tab.en)}
            </button>
          ))}
        </div>

        <section
          id="page-panel-content"
          role="tabpanel"
          aria-labelledby="page-tab-content"
          hidden={activeTab !== "content"}
          className="tab-panel"
        >
          <div className="page-stack">
            <Card>
              <h2 className="card-title">{t("Thông tin trang", "Page Metadata")}</h2>
              <div className="grid-form">
                <Input
                  label={t("Tiêu đề", "Title")}
                  value={titleDraft}
                  onChange={(event) =>
                    setTitleDraftMap((prev) => ({
                      ...prev,
                      [pageId]: event.target.value,
                    }))
                  }
                />
                <Input
                  label={t("Biểu tượng", "Icon")}
                  value={iconDraft}
                  onChange={(event) =>
                    setIconDraftMap((prev) => ({
                      ...prev,
                      [pageId]: event.target.value,
                    }))
                  }
                  maxLength={10}
                />
              </div>
              <div className="inline-actions">
                <Button loading={updatePageMutation.isPending} onClick={async () => updatePageMutation.mutateAsync()}>
                  {t("Lưu thông tin", "Save Metadata")}
                </Button>
              </div>
            </Card>

            <Card>
              <h2 className="card-title">{t("Khối nội dung", "Blocks")}</h2>
              <div className="create-block-row">
                <label className="field-root">
                  <span className="field-label">{t("Loại block", "Block Type")}</span>
                  <select
                    className="field-input"
                    value={blockType}
                    onChange={(event) => setBlockType(event.target.value as (typeof BLOCK_TYPES)[number])}
                  >
                    {BLOCK_TYPES.map((type) => (
                      <option value={type} key={type}>
                        {getBlockTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label={t("Nội dung", "Content")}
                  value={blockContent}
                  onChange={(event) => setBlockContent(event.target.value)}
                  placeholder={t("Nhập nội dung block...", "Block content...")}
                />
                <Button
                  loading={createBlockMutation.isPending}
                  disabled={!blockContent.trim()}
                  onClick={async () => {
                    if (!blockContent.trim()) return;
                    await createBlockMutation.mutateAsync();
                  }}
                >
                  {t("Thêm block", "Add Block")}
                </Button>
              </div>

              {blocks.length === 0 ? (
                <p className="muted-text">{t("Chưa có block nào. Hãy thêm block đầu tiên.", "No blocks yet. Add your first block.")}</p>
              ) : null}

              <ul className="block-list">
                {blocks.map((block: Block) => (
                  <li key={block.id} className={selectedBlockId === block.id ? "block-item active" : "block-item"}>
                    <div className="block-head">
                      <strong>{getBlockTypeLabel(block.type)}</strong>
                      <div className="inline-actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedBlockId(block.id);
                            setActiveTab("comments");
                          }}
                        >
                          {t("Bình luận", "Comments")}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={deletingBlockId === block.id && deleteBlockMutation.isPending}
                          disabled={Boolean(deletingBlockId && deletingBlockId !== block.id)}
                          onClick={async () => {
                            const confirmed = window.confirm(
                              t(
                                "Bạn có chắc muốn xóa block này?",
                                "Are you sure you want to delete this block?",
                              ),
                            );
                            if (!confirmed) return;

                            setDeletingBlockId(block.id);
                            try {
                              await deleteBlockMutation.mutateAsync(block.id);
                            } finally {
                              setDeletingBlockId(null);
                            }
                          }}
                        >
                          {t("Xóa", "Delete")}
                        </Button>
                      </div>
                    </div>

                    <textarea
                      className="block-editor"
                      rows={4}
                      aria-label={`${t("Nội dung block", "Block content")} ${block.type}`}
                      value={draftMap[block.id] ?? toEditableText(block.content)}
                      onChange={(event) =>
                        setDraftMap((prev) => ({
                          ...prev,
                          [block.id]: event.target.value,
                        }))
                      }
                    />

                    <Button
                      size="sm"
                      loading={updateBlockMutation.isPending}
                      onClick={async () => {
                        await updateBlockMutation.mutateAsync({
                          blockId: block.id,
                          content: draftMap[block.id] ?? toEditableText(block.content),
                        });
                      }}
                    >
                      {t("Lưu block", "Save Block")}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section
          id="page-panel-comments"
          role="tabpanel"
          aria-labelledby="page-tab-comments"
          hidden={activeTab !== "comments"}
          className="tab-panel"
        >
          <Card>
            <h2 className="card-title">{t("Bình luận", "Comments")}</h2>
            {blocks.length === 0 ? (
              <p className="muted-text">{t("Bạn cần tạo block trước khi thêm bình luận.", "Create a block before adding comments.")}</p>
            ) : (
              <>
                <label className="field-root">
                  <span className="field-label">{t("Chọn block", "Select block")}</span>
                  <select
                    className="field-input"
                    value={selectedBlockId || ""}
                    onChange={(event) => setSelectedBlockId(event.target.value || null)}
                  >
                    {blocks.map((block) => (
                      <option key={block.id} value={block.id}>
                        {getBlockTypeLabel(block.type)} - {toEditableText(block.content).slice(0, 48) || t("(trống)", "(empty)")}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedBlock ? (
                  <p className="muted-text">
                    {t("Đang bình luận cho block", "Commenting on block")}: {getBlockTypeLabel(selectedBlock.type)}
                  </p>
                ) : null}

                <Input
                  label={t("Bình luận mới", "New Comment")}
                  value={commentContent}
                  onChange={(event) => setCommentContent(event.target.value)}
                  placeholder={t("Nhập nội dung phản hồi...", "Write your feedback...")}
                />
                <Button
                  loading={createCommentMutation.isPending}
                  disabled={!commentContent.trim() || !selectedBlockId}
                  onClick={async () => {
                    if (!commentContent.trim() || !selectedBlockId) return;
                    await createCommentMutation.mutateAsync();
                  }}
                >
                  {t("Thêm bình luận", "Add Comment")}
                </Button>

                {(commentsQuery.data || []).length === 0 ? (
                  <p className="muted-text">{t("Chưa có bình luận nào cho block này.", "No comments for this block yet.")}</p>
                ) : null}

                <ul className="comment-list">
                  {(commentsQuery.data || []).map((comment) => (
                    <li key={comment.id}>
                      <div>
                        <strong>{comment.user?.name || t("Người dùng", "User")}</strong>
                        <p>{comment.content}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={deletingCommentId === comment.id && deleteCommentMutation.isPending}
                        disabled={Boolean(deletingCommentId && deletingCommentId !== comment.id)}
                        onClick={async () => {
                          const confirmed = window.confirm(
                            t(
                              "Bạn có chắc muốn xóa bình luận này?",
                              "Are you sure you want to delete this comment?",
                            ),
                          );
                          if (!confirmed) return;

                          setDeletingCommentId(comment.id);
                          try {
                            await deleteCommentMutation.mutateAsync(comment.id);
                          } finally {
                            setDeletingCommentId(null);
                          }
                        }}
                      >
                        {t("Xóa", "Remove")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </section>

        <section
          id="page-panel-share-files"
          role="tabpanel"
          aria-labelledby="page-tab-share-files"
          hidden={activeTab !== "share-files"}
          className="tab-panel"
        >
          <div className="two-col-grid">
            <Card>
              <h2 className="card-title">{t("Chia sẻ và xuất file", "Share and export")}</h2>
              <div className="inline-actions">
                <Button variant="ghost" loading={shareMutation.isPending} onClick={async () => shareMutation.mutateAsync()}>
                  {t("Tạo link chia sẻ", "Generate Share Link")}
                </Button>
                <Button variant="secondary" loading={exportMutation.isPending} onClick={async () => exportMutation.mutateAsync()}>
                  {t("Xuất Markdown", "Export Markdown")}
                </Button>
              </div>

              {shareUrl ? (
                <div className="share-link-box">
                  <span>{shareUrl}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(shareUrl);
                      pushToast({
                        kind: "info",
                        title: t("Đã sao chép", "Copied"),
                        message: t("Link chia sẻ đã được sao chép vào clipboard.", "Share link copied to clipboard."),
                      });
                    }}
                  >
                    {t("Sao chép", "Copy")}
                  </Button>
                </div>
              ) : (
                <p className="muted-text">{t("Tạo link để chia sẻ trang này cho người khác.", "Generate a link to share this page.")}</p>
              )}
            </Card>

            <Card>
              <h2 className="card-title">{t("Tải tệp lên", "Storage Upload")}</h2>
              <label className="field-root">
                <span className="field-label">{t("Chọn ảnh", "Choose image")}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setUploadFile(file);
                  }}
                />
              </label>
              <div className="inline-actions">
                <Button
                  variant="secondary"
                  loading={uploadMutation.isPending}
                  onClick={async () => {
                    if (!uploadFile) return;
                    await uploadMutation.mutateAsync();
                  }}
                >
                  {t("Tải ảnh lên", "Upload Image")}
                </Button>
                <Button
                  variant="danger"
                  loading={deleteUploadMutation.isPending}
                  disabled={!uploadedObjectName}
                  onClick={async () => {
                    if (!uploadedObjectName) return;
                    const confirmed = window.confirm(
                      t(
                        "Bạn có chắc muốn xóa tệp đã tải lên?",
                        "Are you sure you want to delete uploaded file?",
                      ),
                    );
                    if (!confirmed) return;
                    await deleteUploadMutation.mutateAsync();
                  }}
                >
                  {t("Xóa tệp đã tải", "Delete Uploaded")}
                </Button>
              </div>
              {uploadedObjectName ? (
                <p className="muted-text">{t("Mã tệp đã tải", "Uploaded key")}: {uploadedObjectName}</p>
              ) : (
                <p className="muted-text">{t("Sau khi upload, URL ảnh sẽ điền sẵn vào ô nội dung block.", "After upload, image URL is prefilled into block content.")}</p>
              )}
            </Card>
          </div>
        </section>
      </section>
    </div>
  );
}
