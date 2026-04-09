import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
import type { Block, Comment, PageVersion } from "../../types/api";
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

interface BlockContentTemplate {
  key: string;
  label: string;
  content: string;
}

type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

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

type BlockType = (typeof BLOCK_TYPES)[number];

type PageDetailTab = "content" | "comments" | "share-files";
type CommentViewMode = "all" | "unresolved" | "resolved";

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

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/i);
  return match?.[0] ?? null;
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
  const { accessToken, user } = useAuthStore();
  const [titleDraftMap, setTitleDraftMap] = useState<Record<string, string>>({});
  const [iconDraftMap, setIconDraftMap] = useState<Record<string, string>>({});
  const [blockType, setBlockType] = useState<BlockType>("paragraph");
  const [blockContent, setBlockContent] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadedObjectName, setUploadedObjectName] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [createImagePreviewError, setCreateImagePreviewError] = useState(false);
  const [draftMap, setDraftMap] = useState<Record<string, string>>({});
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [processingCommentId, setProcessingCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);
  const [movingBlockId, setMovingBlockId] = useState<string | null>(null);
  const [movingBlockDirection, setMovingBlockDirection] = useState<"up" | "down" | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [commentViewMode, setCommentViewMode] = useState<CommentViewMode>("all");
  const [activeTab, setActiveTab] = useState<PageDetailTab>("content");
  const [autosaveStateByBlock, setAutosaveStateByBlock] = useState<Record<string, AutosaveState>>({});
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const blockItemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const autosaveTimersRef = useRef<Record<string, number>>({});
  const autosaveSequenceRef = useRef<Record<string, number>>({});

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

  const blockTemplatesByType = useMemo<Record<BlockType, BlockContentTemplate[]>>(
    () => ({
      paragraph: [
        {
          key: "meeting-note",
          label: t("Ghi chú họp", "Meeting note"),
          content: [
            "Mục tiêu:",
            "- ",
            "Kết luận chính:",
            "- ",
            "Việc cần làm tiếp:",
            "- ",
          ].join("\n"),
        },
        {
          key: "daily-summary",
          label: t("Tóm tắt hằng ngày", "Daily summary"),
          content: [
            "Hôm nay đã hoàn thành:",
            "- ",
            "Vướng mắc:",
            "- ",
            "Kế hoạch ngày mai:",
            "- ",
          ].join("\n"),
        },
        {
          key: "google-meet-link",
          label: t("Link Google Meet", "Google Meet link"),
          content: "https://meet.google.com/aaa-bbbb-ccc",
        },
        {
          key: "google-calendar-link",
          label: t("Link Google Calendar", "Google Calendar link"),
          content: "https://calendar.google.com/calendar/u/0/r/week",
        },
      ],
      heading1: [
        {
          key: "main-title",
          label: t("Tiêu đề chính", "Main heading"),
          content: t("Kế hoạch triển khai", "Execution plan"),
        },
      ],
      heading2: [
        {
          key: "section-title",
          label: t("Tiêu đề mục", "Section heading"),
          content: t("Mục tiêu tuần này", "Goals for this week"),
        },
      ],
      heading3: [
        {
          key: "subsection-title",
          label: t("Tiêu đề nhỏ", "Sub-heading"),
          content: t("Chi tiết thực hiện", "Implementation details"),
        },
      ],
      bulletList: [
        {
          key: "key-points",
          label: t("Ý chính", "Key points"),
          content: ["- Ý chính 1", "- Ý chính 2", "- Ý chính 3"].join("\n"),
        },
        {
          key: "risk-list",
          label: t("Danh sách rủi ro", "Risk list"),
          content: ["- Rủi ro", "- Tác động", "- Phương án giảm thiểu"].join("\n"),
        },
      ],
      orderedList: [
        {
          key: "step-by-step",
          label: t("Theo từng bước", "Step-by-step"),
          content: ["1. Bước 1", "2. Bước 2", "3. Bước 3"].join("\n"),
        },
      ],
      taskList: [
        {
          key: "daily",
          label: t("Checklist hằng ngày", "Daily checklist"),
          content: [
            "- [ ] Kiểm tra nhanh tiến độ hôm nay",
            "- [ ] Cập nhật trạng thái các việc đang làm",
            "- [ ] Ghi chú blocker cần hỗ trợ",
          ].join("\n"),
        },
        {
          key: "sprint",
          label: t("Checklist sprint", "Sprint checklist"),
          content: [
            "- [ ] Chia task theo độ ưu tiên",
            "- [ ] Gán người phụ trách cho từng task",
            "- [ ] Chốt deadline và tiêu chí hoàn thành",
          ].join("\n"),
        },
        {
          key: "bugfix",
          label: t("Checklist bugfix", "Bugfix checklist"),
          content: [
            "- [ ] Reproduce bug và ghi lại steps",
            "- [ ] Sửa lỗi + viết test hồi quy",
            "- [ ] Verify fix trên staging",
          ].join("\n"),
        },
        {
          key: "release",
          label: t("Checklist release", "Release checklist"),
          content: [
            "- [ ] Kiểm tra lint/build trước release",
            "- [ ] Chạy smoke test các flow chính",
            "- [ ] Xác nhận deploy và health endpoint",
          ].join("\n"),
        },
      ],
      codeBlock: [
        {
          key: "code-sample",
          label: t("Mẫu code", "Code sample"),
          content: [
            "function runTask(input) {",
            "  if (!input) return null;",
            "  return input;",
            "}",
          ].join("\n"),
        },
      ],
      image: [
        {
          key: "image-url",
          label: t("URL ảnh", "Image URL"),
          content: "https://images.unsplash.com/photo-1518773553398-650c184e0bb3",
        },
      ],
      divider: [],
      quote: [
        {
          key: "quote-note",
          label: t("Trích dẫn", "Quote"),
          content: t("Đơn giản tạo nên khác biệt. - Anonymous", "Simplicity makes the difference. - Anonymous"),
        },
      ],
      table: [
        {
          key: "table-template",
          label: t("Bảng cơ bản", "Basic table"),
          content: ["| Hạng mục | Trạng thái | Owner |", "| --- | --- | --- |", "| API | In progress | Hoang |"].join("\n"),
        },
      ],
    }),
    [t],
  );

  const createBlockTemplates = blockTemplatesByType[blockType] ?? [];
  const createBlockContent = blockType === "divider" && !blockContent.trim() ? "---" : blockContent;
  const canCreateBlock = blockType === "divider" || Boolean(blockContent.trim());
  const createImageUrl = blockType === "image" ? blockContent.trim() : "";
  const canShowCreateImagePreview = /^(https?:\/\/|data:image\/)/i.test(createImageUrl);

  const getCreateBlockPlaceholder = (type: BlockType) => {
    if (type === "taskList") {
      return t(
        "Ví dụ:\n- [ ] Chuẩn bị dữ liệu\n- [ ] Review task\n- [ ] Chốt deadline",
        "Example:\n- [ ] Prepare data\n- [ ] Review tasks\n- [ ] Finalize deadline",
      );
    }

    if (type === "codeBlock") {
      return t("Dán code hoặc pseudo-code...", "Paste code or pseudo-code...");
    }

    if (type === "table") {
      return t("Nhập bảng theo dạng markdown...", "Enter markdown table...");
    }

    if (type === "image") {
      return t("Dán URL ảnh hoặc upload trong tab Chia sẻ/Tệp", "Paste image URL or upload from Share/Files tab");
    }

    if (type === "divider") {
      return t("Có thể để trống để thêm đường phân cách", "Leave empty to insert a divider");
    }

    return t("Nhập nội dung block...", "Block content...");
  };

  const getBlockTypeLabel = (type: string) => blockTypeLabelMap[type] || type;

  const onCreateBlockTypeChange = (nextType: BlockType) => {
    setBlockType(nextType);

    const templatesForType = blockTemplatesByType[nextType] ?? [];

    if (!blockContent.trim() && templatesForType[0]) {
      setBlockContent(templatesForType[0].content);
      pushToast({
        kind: "info",
        title: t("Đã điền mẫu nhanh", "Template applied"),
        message: t(
          `Đã tự điền mẫu cho ${getBlockTypeLabel(nextType)} khi ô nội dung trống.`,
          `Applied a ${getBlockTypeLabel(nextType)} template because content was empty.`,
        ),
      });
    }
  };

  const jumpToBlock = (blockId: string) => {
    setSelectedBlockId(blockId);
    setActiveTab("content");

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        blockItemRefs.current[blockId]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    });
  };

  const clearBlockAutosaveTimer = (blockId: string) => {
    const timerId = autosaveTimersRef.current[blockId];
    if (timerId) {
      window.clearTimeout(timerId);
      delete autosaveTimersRef.current[blockId];
    }
  };

  const setBlockAutosaveState = (blockId: string, state: AutosaveState) => {
    setAutosaveStateByBlock((prev) => ({
      ...prev,
      [blockId]: state,
    }));
  };

  const getAutosaveHint = (state: AutosaveState) => {
    if (state === "pending") return t("Sắp tự động lưu...", "Autosave queued...");
    if (state === "saving") return t("Đang tự động lưu...", "Autosaving...");
    if (state === "saved") return t("Đã tự động lưu", "Autosaved");
    if (state === "error") return t("Tự động lưu lỗi, hãy bấm Lưu block", "Autosave failed, use Save Block");
    return "";
  };

  const scheduleBlockAutosave = (blockId: string, nextContent: string, savedContent: string) => {
    if (nextContent === savedContent) {
      clearBlockAutosaveTimer(blockId);
      setBlockAutosaveState(blockId, "idle");
      return;
    }

    clearBlockAutosaveTimer(blockId);

    const nextSequence = (autosaveSequenceRef.current[blockId] ?? 0) + 1;
    autosaveSequenceRef.current[blockId] = nextSequence;

    setBlockAutosaveState(blockId, "pending");

    autosaveTimersRef.current[blockId] = window.setTimeout(async () => {
      setBlockAutosaveState(blockId, "saving");

      try {
        await blocksApi.update(blockId, { content: nextContent });
        queryClient.invalidateQueries({ queryKey: ["page", pageId, "versions"] });

        if (autosaveSequenceRef.current[blockId] !== nextSequence) return;

        setBlockAutosaveState(blockId, "saved");

        window.setTimeout(() => {
          if (autosaveSequenceRef.current[blockId] !== nextSequence) return;
          setBlockAutosaveState(blockId, "idle");
        }, 1200);
      } catch {
        if (autosaveSequenceRef.current[blockId] !== nextSequence) return;
        setBlockAutosaveState(blockId, "error");
      }
    }, 900);
  };

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

  const versionsQuery = useQuery({
    queryKey: ["page", pageId, "versions"],
    queryFn: () => pagesApi.getVersions(pageId),
    enabled: Boolean(pageId),
    staleTime: 30_000,
  });

  const blocks = useMemo(() => blocksQuery.data ?? [], [blocksQuery.data]);
  const pageVersions = useMemo(() => versionsQuery.data ?? [], [versionsQuery.data]);

  const commentsQuery = useQuery({
    queryKey: ["block", selectedBlockId, "comments"],
    queryFn: () => commentsApi.list(selectedBlockId || ""),
    enabled: Boolean(selectedBlockId),
  });

  const blockCommentCountQueries = useQueries({
    queries: blocks.map((block) => ({
      queryKey: ["page", pageId, "block-comments-count", block.id],
      queryFn: () => commentsApi.list(block.id),
      enabled: Boolean(pageId),
      staleTime: 30_000,
      select: (comments: Comment[]) => ({
        total: comments.length,
        unresolved: comments.filter((comment) => !comment.isResolved).length,
      }),
    })),
  });

  const commentsCountByBlockId = useMemo(() => {
    const countMap: Record<string, number> = {};

    blocks.forEach((block, index) => {
      countMap[block.id] = blockCommentCountQueries[index]?.data?.total ?? 0;
    });

    return countMap;
  }, [blocks, blockCommentCountQueries]);

  const unresolvedCommentsCountByBlockId = useMemo(() => {
    const countMap: Record<string, number> = {};

    blocks.forEach((block, index) => {
      countMap[block.id] = blockCommentCountQueries[index]?.data?.unresolved ?? 0;
    });

    return countMap;
  }, [blocks, blockCommentCountQueries]);

  const blockComments = useMemo(() => commentsQuery.data ?? [], [commentsQuery.data]);
  const unresolvedBlockComments = blockComments.filter((comment) => !comment.isResolved);
  const resolvedBlockComments = blockComments.filter((comment) => comment.isResolved);
  const filteredBlockComments =
    commentViewMode === "unresolved"
      ? unresolvedBlockComments
      : commentViewMode === "resolved"
        ? resolvedBlockComments
        : blockComments;

  const commentActivities = useMemo(() => {
    const activities: Array<{ id: string; action: "created" | "resolved" | "reopened"; at: string; actor: string }> = [];

    blockComments.forEach((comment) => {
      activities.push({
        id: `${comment.id}-created`,
        action: "created",
        at: comment.createdAt,
        actor: comment.user?.name || t("Người dùng", "User"),
      });

      if (comment.resolvedAt) {
        activities.push({
          id: `${comment.id}-resolved`,
          action: "resolved",
          at: comment.resolvedAt,
          actor: comment.resolvedByUser?.name || t("Người dùng", "User"),
        });
      }

      if (comment.reopenedAt) {
        activities.push({
          id: `${comment.id}-reopened`,
          action: "reopened",
          at: comment.reopenedAt,
          actor: comment.reopenedByUser?.name || t("Người dùng", "User"),
        });
      }
    });

    return activities
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [blockComments, t]);

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString();
  };

  const getCommentActivityLabel = (action: "created" | "resolved" | "reopened") => {
    if (action === "created") return t("đã tạo bình luận", "created a comment");
    if (action === "resolved") return t("đã đánh dấu đã xử lý", "resolved a comment");
    return t("đã mở lại bình luận", "reopened a comment");
  };

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
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "versions"] });
    });

    socket.on("block-created", () => {
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "blocks"] });
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "versions"] });
    });

    socket.on("block-deleted", () => {
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "blocks"] });
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "versions"] });
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
    mutationFn: (payload: { type: BlockType; content: string }) => blocksApi.create(pageId, payload),
    onSuccess: () => {
      setBlockContent("");
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "blocks"] });
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "versions"] });
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
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "versions"] });
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
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "versions"] });
      pushToast({
        kind: "success",
        title: t("Đã xóa block", "Block deleted"),
        message: t("Block đã được xóa khỏi trang.", "The block has been removed from page."),
      });
    },
  });

  const reorderBlocksMutation = useMutation({
    mutationFn: (blockIds: string[]) => blocksApi.reorder(pageId, blockIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "blocks"] });
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "versions"] });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: () => commentsApi.create(selectedBlockId || "", commentContent),
    onSuccess: () => {
      setCommentContent("");
      queryClient.invalidateQueries({ queryKey: ["block", selectedBlockId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "block-comments-count"] });
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
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "block-comments-count"] });
      pushToast({
        kind: "success",
        title: t("Đã xóa bình luận", "Comment removed"),
        message: t("Bình luận đã được xóa.", "Comment has been removed."),
      });
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: (params: { commentId: string; content: string }) =>
      commentsApi.update(params.commentId, params.content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block", selectedBlockId, "comments"] });
      pushToast({
        kind: "success",
        title: t("Đã sửa bình luận", "Comment updated"),
        message: t("Nội dung bình luận đã được cập nhật.", "Comment content has been updated."),
      });
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.resolve(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block", selectedBlockId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "block-comments-count"] });
      pushToast({
        kind: "success",
        title: t("Đã xử lý bình luận", "Comment resolved"),
        message: t("Bình luận đã được đánh dấu là đã xử lý.", "Comment has been marked as resolved."),
      });
    },
  });

  const reopenCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.reopen(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block", selectedBlockId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "block-comments-count"] });
      pushToast({
        kind: "info",
        title: t("Đã mở lại bình luận", "Comment reopened"),
        message: t("Bình luận đã được chuyển về trạng thái chưa xử lý.", "Comment is now marked as unresolved."),
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: () => storageApi.upload(uploadFile as File),
    onSuccess: (result) => {
      setUploadedObjectName(result.objectName);
      setUploadedFileUrl(result.url);
      setCreateImagePreviewError(false);
      setBlockType("image");
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
      const removedUrl = uploadedFileUrl;
      setUploadedObjectName("");
      setUploadedFileUrl("");
      setBlockContent((prev) => (prev === removedUrl ? "" : prev));
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

  const restoreVersionMutation = useMutation({
    mutationFn: (versionId: string) => pagesApi.restoreVersion(pageId, versionId),
    onSuccess: () => {
      setSelectedBlockId(null);
      setActiveTab("content");
      queryClient.invalidateQueries({ queryKey: ["page", pageId] });
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "blocks"] });
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["page", pageId, "block-comments-count"] });
      pushToast({
        kind: "success",
        title: t("Đã khôi phục phiên bản", "Version restored"),
        message: t("Trang đã được khôi phục về phiên bản đã chọn.", "The page has been restored to the selected version."),
      });
    },
  });

  const moveBlock = async (blockId: string, direction: "up" | "down") => {
    if (reorderBlocksMutation.isPending || blocks.length < 2) return;

    const currentIndex = blocks.findIndex((block) => block.id === blockId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const nextBlockIds = blocks.map((block) => block.id);
    const moved = nextBlockIds[currentIndex];
    if (!moved) return;

    nextBlockIds.splice(currentIndex, 1);
    nextBlockIds.splice(targetIndex, 0, moved);

    setMovingBlockId(blockId);
    setMovingBlockDirection(direction);

    try {
      await reorderBlocksMutation.mutateAsync(nextBlockIds);
      setSelectedBlockId(blockId);
    } finally {
      setMovingBlockId(null);
      setMovingBlockDirection(null);
    }
  };

  const topError = useMemo(
    () =>
      pageQuery.error ||
      blocksQuery.error ||
      versionsQuery.error ||
      commentsQuery.error ||
      createBlockMutation.error ||
      updateBlockMutation.error ||
      deleteBlockMutation.error ||
      reorderBlocksMutation.error ||
      createCommentMutation.error ||
      updateCommentMutation.error ||
      deleteCommentMutation.error ||
      resolveCommentMutation.error ||
      reopenCommentMutation.error ||
      shareMutation.error ||
      uploadMutation.error ||
      deleteUploadMutation.error ||
      updatePageMutation.error ||
      exportMutation.error ||
      restoreVersionMutation.error,
    [
      pageQuery.error,
      blocksQuery.error,
      versionsQuery.error,
      commentsQuery.error,
      createBlockMutation.error,
      updateBlockMutation.error,
      deleteBlockMutation.error,
      reorderBlocksMutation.error,
      createCommentMutation.error,
      updateCommentMutation.error,
      deleteCommentMutation.error,
      resolveCommentMutation.error,
      reopenCommentMutation.error,
      shareMutation.error,
      uploadMutation.error,
      deleteUploadMutation.error,
      updatePageMutation.error,
      exportMutation.error,
      restoreVersionMutation.error,
    ],
  );

  useEffect(() => {
    if (blockType !== "image") return;
    setCreateImagePreviewError(false);
  }, [blockType, blockContent]);

  useEffect(() => {
    setCommentViewMode("all");
    setEditingCommentId(null);
    setEditingCommentContent("");
    setUpdatingCommentId(null);
  }, [selectedBlockId]);

  useEffect(() => {
    if (!editingCommentId) return;

    const stillExists = blockComments.some((comment) => comment.id === editingCommentId);
    if (!stillExists) {
      setEditingCommentId(null);
      setEditingCommentContent("");
      setUpdatingCommentId(null);
    }
  }, [blockComments, editingCommentId]);

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

  useEffect(() => {
    const autosaveTimers = autosaveTimersRef.current;

    return () => {
      Object.values(autosaveTimers).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, []);

  if (pageQuery.isPending || blocksQuery.isPending) {
    return <Loader text={t("Đang tải trang...", "Loading page...")} />;
  }

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
              <div className="version-card-head">
                <h2 className="card-title">{t("Lịch sử phiên bản", "Version History")}</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={versionsQuery.isFetching}
                  onClick={async () => {
                    await versionsQuery.refetch();
                  }}
                >
                  {t("Làm mới", "Refresh")}
                </Button>
              </div>

              {versionsQuery.isPending ? (
                <p className="muted-text">{t("Đang tải lịch sử phiên bản...", "Loading version history...")}</p>
              ) : null}

              {!versionsQuery.isPending && pageVersions.length === 0 ? (
                <p className="muted-text">{t("Chưa có phiên bản nào được lưu.", "No versions have been recorded yet.")}</p>
              ) : null}

              {pageVersions.length > 0 ? (
                <ul className="version-list">
                  {pageVersions.map((version: PageVersion, index) => {
                    const isLatestVersion = index === 0;
                    const isRestoringThisVersion =
                      restoringVersionId === version.id && restoreVersionMutation.isPending;

                    return (
                      <li key={version.id} className="version-item">
                        <div className="version-item-main">
                          <div className="version-item-head">
                            <strong>
                              {isLatestVersion
                                ? t("Phiên bản hiện tại", "Current version")
                                : `${t("Phiên bản", "Version")} #${pageVersions.length - index}`}
                            </strong>
                            {isLatestVersion ? <span className="muted-pill">{t("Mới nhất", "Latest")}</span> : null}
                          </div>
                          <p className="muted-text version-meta-line">
                            {formatDateTime(version.createdAt)} • {t("Người tạo", "Created by")}: {version.createdBy}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={isRestoringThisVersion}
                          disabled={isLatestVersion || restoreVersionMutation.isPending}
                          onClick={async () => {
                            const confirmed = window.confirm(
                              t(
                                "Khôi phục phiên bản này sẽ thay thế block hiện tại. Tiếp tục?",
                                "Restoring this version will replace current blocks. Continue?",
                              ),
                            );
                            if (!confirmed) return;

                            setRestoringVersionId(version.id);
                            try {
                              await restoreVersionMutation.mutateAsync(version.id);
                            } finally {
                              setRestoringVersionId(null);
                            }
                          }}
                        >
                          {t("Khôi phục", "Restore")}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </Card>

            <Card>
              <h2 className="card-title">{t("Khối nội dung", "Blocks")}</h2>
              <div className="create-block-row">
                <label className="field-root">
                  <span className="field-label">{t("Loại block", "Block Type")}</span>
                  <select
                    className="field-input"
                    value={blockType}
                    onChange={(event) =>
                      onCreateBlockTypeChange(event.target.value as (typeof BLOCK_TYPES)[number])
                    }
                  >
                    {BLOCK_TYPES.map((type) => (
                      <option value={type} key={type}>
                        {getBlockTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-root">
                  <span className="field-label">{t("Nội dung", "Content")}</span>
                  <textarea
                    className="block-editor create-block-editor"
                    rows={
                      ["paragraph", "bulletList", "orderedList", "taskList", "codeBlock", "quote", "table"].includes(blockType)
                        ? 4
                        : 2
                    }
                    value={blockContent}
                    onChange={(event) => setBlockContent(event.target.value)}
                    placeholder={getCreateBlockPlaceholder(blockType)}
                    aria-label={t("Nội dung block mới", "New block content")}
                  />
                </label>

                {createBlockTemplates.length === 0 ? (
                  <p className="muted-text create-block-hint">
                    {blockType === "divider"
                      ? t(
                        "Divider có thể thêm ngay cả khi để trống nội dung.",
                        "Divider can be added even when content is empty.",
                      )
                      : t(
                        "Loại block này không cần prefill. Bạn có thể nhập nội dung trực tiếp.",
                        "This block type does not need prefill. You can type directly.",
                      )}
                  </p>
                ) : (
                  <p className="muted-text create-block-hint">
                    {t(
                      "Mẫu mặc định sẽ tự điền khi ô trống, và không ghi đè nội dung bạn đã gõ.",
                      "Default template auto-fills only when empty, and never overwrites your typed text.",
                    )}
                  </p>
                )}

                {blockType === "image" ? (
                  <div className="create-image-preview-shell">
                    <div className="create-image-preview-head">
                      <span className="field-label">{t("Xem trước ảnh", "Image preview")}</span>
                      {canShowCreateImagePreview && !createImagePreviewError ? (
                        <a
                          href={createImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="create-image-preview-link"
                        >
                          {t("Mở ảnh gốc", "Open original")}
                        </a>
                      ) : null}
                    </div>

                    {canShowCreateImagePreview && !createImagePreviewError ? (
                      <img
                        src={createImageUrl}
                        alt={t("Xem trước ảnh block", "Image block preview")}
                        className="create-image-preview"
                        loading="lazy"
                        onError={() => setCreateImagePreviewError(true)}
                      />
                    ) : (
                      <div className="create-image-preview-placeholder">
                        <p className="muted-text">
                          {createImageUrl
                            ? t(
                              "Không thể tải ảnh từ URL này. Hãy kiểm tra lại link hoặc upload lại.",
                              "Cannot load this URL. Check the link or upload again.",
                            )
                            : t(
                              "Dán URL ảnh để xem preview trước khi thêm block.",
                              "Paste an image URL to preview before adding the block.",
                            )}
                        </p>
                        {createImageUrl ? (
                          <button
                            type="button"
                            className="template-btn template-btn-muted"
                            onClick={() => setCreateImagePreviewError(false)}
                          >
                            {t("Thử tải lại", "Retry preview")}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}

                {createBlockTemplates.length > 0 ? (
                  <div
                    className="block-template-wrap"
                    role="group"
                    aria-label={t("Gợi ý mẫu nội dung block", "Block content template suggestions")}
                  >
                    <span className="field-label">{t("Mẫu gợi ý nhanh", "Quick templates")}</span>
                    <div className="block-template-actions">
                      {blockType === "image" && uploadedFileUrl ? (
                        <button
                          type="button"
                          className="template-btn"
                          onClick={() => setBlockContent(uploadedFileUrl)}
                        >
                          {t("Dùng ảnh vừa upload", "Use uploaded image URL")}
                        </button>
                      ) : null}
                      {createBlockTemplates.map((template) => (
                        <button
                          key={template.key}
                          type="button"
                          className="template-btn"
                          onClick={() => setBlockContent(template.content)}
                        >
                          {template.label}
                        </button>
                      ))}
                      {blockContent.trim() ? (
                        <button
                          type="button"
                          className="template-btn template-btn-muted"
                          onClick={() => setBlockContent("")}
                        >
                          {t("Xóa nội dung", "Clear draft")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <Button
                  loading={createBlockMutation.isPending}
                  disabled={!canCreateBlock}
                  onClick={async () => {
                    if (!canCreateBlock) return;
                    await createBlockMutation.mutateAsync({
                      type: blockType,
                      content: createBlockContent,
                    });
                  }}
                >
                  {t("Thêm block", "Add Block")}
                </Button>
              </div>

              {blocks.length === 0 ? (
                <p className="muted-text">{t("Chưa có block nào. Hãy thêm block đầu tiên.", "No blocks yet. Add your first block.")}</p>
              ) : null}

              <ul className="block-list page-block-list">
                {blocks.map((block: Block, blockIndex) => {
                  const isActive = selectedBlockId === block.id;
                  const readableContent = toEditableText(block.content);
                  const unresolvedCount = unresolvedCommentsCountByBlockId[block.id] ?? 0;
                  const quickOpenUrl = extractFirstUrl(readableContent);
                  const isGoogleMeetLink = Boolean(quickOpenUrl && /meet\.google\.com/i.test(quickOpenUrl));
                  const isGoogleCalendarLink = Boolean(quickOpenUrl && /calendar\.google\.com/i.test(quickOpenUrl));
                  const canMoveUp = blockIndex > 0;
                  const canMoveDown = blockIndex < blocks.length - 1;
                  const isMovingUp =
                    movingBlockId === block.id &&
                    movingBlockDirection === "up" &&
                    reorderBlocksMutation.isPending;
                  const isMovingDown =
                    movingBlockId === block.id &&
                    movingBlockDirection === "down" &&
                    reorderBlocksMutation.isPending;

                  return (
                    <li
                      key={block.id}
                      className={isActive ? "block-item active" : "block-item"}
                      ref={(node) => {
                        blockItemRefs.current[block.id] = node;
                      }}
                    >
                      <div className="block-head">
                        <div className="block-head-main">
                          <strong>{getBlockTypeLabel(block.type)}</strong>
                          <span className="muted-pill">#{blockIndex + 1}</span>
                          {!isActive ? <span className="muted-pill">{t("Thu gọn", "Collapsed")}</span> : null}
                        </div>
                        <div className="inline-actions">
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={isMovingUp}
                            disabled={!canMoveUp || reorderBlocksMutation.isPending}
                            onClick={async () => {
                              await moveBlock(block.id, "up");
                            }}
                          >
                            {t("Lên", "Up")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={isMovingDown}
                            disabled={!canMoveDown || reorderBlocksMutation.isPending}
                            onClick={async () => {
                              await moveBlock(block.id, "down");
                            }}
                          >
                            {t("Xuống", "Down")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedBlockId(block.id);
                              setActiveTab("comments");
                            }}
                          >
                            {t("Bình luận", "Comments")}
                            <span className="comment-count-badge">{commentsCountByBlockId[block.id] ?? 0}</span>
                            {unresolvedCount > 0 ? (
                              <span className="comment-unresolved-badge" title={t("Comment chưa xử lý", "Unresolved comments")}>
                                {unresolvedCount}
                              </span>
                            ) : null}
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

                      {isActive ? (
                        <>
                          <textarea
                            className="block-editor"
                            rows={5}
                            aria-label={`${t("Nội dung block", "Block content")} ${block.type}`}
                            value={draftMap[block.id] ?? readableContent}
                            onChange={(event) => {
                              const nextValue = event.target.value;

                              setDraftMap((prev) => ({
                                ...prev,
                                [block.id]: nextValue,
                              }));

                              scheduleBlockAutosave(block.id, nextValue, readableContent);
                            }}
                          />

                          <div className="block-edit-actions">
                            {(autosaveStateByBlock[block.id] ?? "idle") !== "idle" ? (
                              <p
                                className={
                                  (autosaveStateByBlock[block.id] ?? "idle") === "error"
                                    ? "autosave-hint autosave-hint-error"
                                    : "autosave-hint"
                                }
                              >
                                {getAutosaveHint(autosaveStateByBlock[block.id] ?? "idle")}
                              </p>
                            ) : (
                              <span />
                            )}

                            <Button
                              size="sm"
                              loading={updateBlockMutation.isPending}
                              onClick={async () => {
                                clearBlockAutosaveTimer(block.id);
                                autosaveSequenceRef.current[block.id] =
                                  (autosaveSequenceRef.current[block.id] ?? 0) + 1;
                                setBlockAutosaveState(block.id, "saving");

                                try {
                                  await updateBlockMutation.mutateAsync({
                                    blockId: block.id,
                                    content: draftMap[block.id] ?? readableContent,
                                  });

                                  setBlockAutosaveState(block.id, "saved");
                                  window.setTimeout(() => {
                                    setBlockAutosaveState(block.id, "idle");
                                  }, 1200);
                                } catch {
                                  setBlockAutosaveState(block.id, "error");
                                }
                              }}
                            >
                              {t("Lưu block", "Save Block")}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="block-preview-wrap">
                          <p className="block-preview">{readableContent || t("(trống)", "(empty)")}</p>
                          <div className="block-preview-actions">
                            {quickOpenUrl && (isGoogleMeetLink || isGoogleCalendarLink) ? (
                              <a
                                href={quickOpenUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="link-button link-button-sm"
                              >
                                {isGoogleMeetLink
                                  ? t("Mở Google Meet", "Open Google Meet")
                                  : t("Mở Google Calendar", "Open Google Calendar")}
                              </a>
                            ) : null}
                            <Button size="sm" variant="secondary" onClick={() => setSelectedBlockId(block.id)}>
                              {t("Mở chỉnh sửa", "Open editor")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
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
                  <div className="comment-toolbar">
                    <p className="muted-text">
                      {t("Đang bình luận cho block", "Commenting on block")}: {getBlockTypeLabel(selectedBlock.type)}
                    </p>
                    <div className="comment-summary-badges">
                      <span className="comment-status-pill comment-status-pill-open">
                        {t("Chưa xử lý", "Unresolved")}: {unresolvedBlockComments.length}
                      </span>
                      <span className="comment-status-pill comment-status-pill-resolved">
                        {t("Đã xử lý", "Resolved")}: {resolvedBlockComments.length}
                      </span>
                    </div>
                    <div className="comment-filter-group" role="group" aria-label={t("Lọc bình luận", "Comment filter")}>
                      <button
                        type="button"
                        className={commentViewMode === "all" ? "comment-filter-btn active" : "comment-filter-btn"}
                        onClick={() => setCommentViewMode("all")}
                      >
                        {t("Tất cả", "All")}
                      </button>
                      <button
                        type="button"
                        className={commentViewMode === "unresolved" ? "comment-filter-btn active" : "comment-filter-btn"}
                        onClick={() => setCommentViewMode("unresolved")}
                      >
                        {t("Chưa xử lý", "Unresolved")}
                      </button>
                      <button
                        type="button"
                        className={commentViewMode === "resolved" ? "comment-filter-btn active" : "comment-filter-btn"}
                        onClick={() => setCommentViewMode("resolved")}
                      >
                        {t("Đã xử lý", "Resolved")}
                      </button>
                    </div>
                  </div>
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

                {blockComments.length === 0 ? (
                  <p className="muted-text">{t("Chưa có bình luận nào cho block này.", "No comments for this block yet.")}</p>
                ) : null}

                {blockComments.length > 0 && filteredBlockComments.length === 0 ? (
                  <p className="muted-text">{t("Không có bình luận phù hợp bộ lọc hiện tại.", "No comments match the current filter.")}</p>
                ) : null}

                <ul className="comment-list">
                  {filteredBlockComments.map((comment) => {
                    const isEditingComment = editingCommentId === comment.id;
                    const canEditComment = comment.userId === user?.id;
                    const isUpdatingThisComment =
                      updatingCommentId === comment.id && updateCommentMutation.isPending;
                    const isActionLockedByOtherComment = Boolean(
                      (deletingCommentId && deletingCommentId !== comment.id) ||
                        (processingCommentId && processingCommentId !== comment.id) ||
                        (updatingCommentId && updatingCommentId !== comment.id),
                    );
                    const canShowEditedFlag = comment.updatedAt !== comment.createdAt;

                    return (
                      <li key={comment.id} className={comment.isResolved ? "comment-item resolved" : "comment-item"}>
                        <div className="comment-item-main">
                          <div className="comment-item-head">
                            <strong>{comment.user?.name || t("Người dùng", "User")}</strong>
                            <span className={comment.isResolved ? "comment-status-pill comment-status-pill-resolved" : "comment-status-pill comment-status-pill-open"}>
                              {comment.isResolved ? t("Đã xử lý", "Resolved") : t("Chưa xử lý", "Unresolved")}
                            </span>
                          </div>

                          {isEditingComment ? (
                            <div className="comment-edit-shell">
                              <textarea
                                className="block-editor comment-edit-textarea"
                                rows={3}
                                value={editingCommentContent}
                                onChange={(event) => setEditingCommentContent(event.target.value)}
                                aria-label={t("Nội dung bình luận", "Comment content")}
                              />
                              <div className="comment-edit-actions">
                                <Button
                                  size="sm"
                                  loading={isUpdatingThisComment}
                                  disabled={!editingCommentContent.trim() || updateCommentMutation.isPending}
                                  onClick={async () => {
                                    if (!editingCommentContent.trim()) return;

                                    setUpdatingCommentId(comment.id);
                                    try {
                                      await updateCommentMutation.mutateAsync({
                                        commentId: comment.id,
                                        content: editingCommentContent.trim(),
                                      });
                                      setEditingCommentId(null);
                                      setEditingCommentContent("");
                                    } finally {
                                      setUpdatingCommentId(null);
                                    }
                                  }}
                                >
                                  {t("Lưu sửa", "Save changes")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isUpdatingThisComment}
                                  onClick={() => {
                                    setEditingCommentId(null);
                                    setEditingCommentContent("");
                                  }}
                                >
                                  {t("Hủy", "Cancel")}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p>{comment.content}</p>
                          )}

                          <p className="muted-text comment-meta">
                            {t("Tạo lúc", "Created at")}: {formatDateTime(comment.createdAt)}
                            {canShowEditedFlag ? ` • ${t("Đã chỉnh sửa", "Edited")}` : ""}
                            {comment.isResolved && comment.resolvedAt
                              ? ` • ${t("Đã xử lý lúc", "Resolved at")}: ${formatDateTime(comment.resolvedAt)}`
                              : ""}
                            {!comment.isResolved && comment.reopenedAt
                              ? ` • ${t("Mở lại lúc", "Reopened at")}: ${formatDateTime(comment.reopenedAt)}`
                              : ""}
                          </p>
                        </div>

                        <div className="comment-item-actions">
                          {canEditComment && !isEditingComment ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isActionLockedByOtherComment || Boolean(processingCommentId === comment.id)}
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentContent(comment.content);
                              }}
                            >
                              {t("Sửa", "Edit")}
                            </Button>
                          ) : null}

                          <Button
                            size="sm"
                            variant={comment.isResolved ? "secondary" : "ghost"}
                            loading={
                              processingCommentId === comment.id &&
                              (resolveCommentMutation.isPending || reopenCommentMutation.isPending)
                            }
                            disabled={
                              isEditingComment ||
                              isUpdatingThisComment ||
                              isActionLockedByOtherComment
                            }
                            onClick={async () => {
                              setProcessingCommentId(comment.id);
                              try {
                                if (comment.isResolved) {
                                  await reopenCommentMutation.mutateAsync(comment.id);
                                } else {
                                  await resolveCommentMutation.mutateAsync(comment.id);
                                }
                              } finally {
                                setProcessingCommentId(null);
                              }
                            }}
                          >
                            {comment.isResolved ? t("Mở lại", "Reopen") : t("Đánh dấu đã xử lý", "Resolve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isActionLockedByOtherComment}
                            onClick={() => {
                              if (!selectedBlockId) return;
                              jumpToBlock(selectedBlockId);
                            }}
                          >
                            {t("Đến block", "Jump to block")}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={deletingCommentId === comment.id && deleteCommentMutation.isPending}
                            disabled={
                              isEditingComment ||
                              isUpdatingThisComment ||
                              Boolean(
                                (deletingCommentId && deletingCommentId !== comment.id) ||
                                  (processingCommentId && processingCommentId !== comment.id),
                              )
                            }
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
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {commentActivities.length > 0 ? (
                  <div className="comment-activity-feed">
                    <h3 className="card-subtitle">{t("Hoạt động bình luận gần đây", "Recent comment activity")}</h3>
                    <ul className="comment-activity-list">
                      {commentActivities.map((activity) => (
                        <li key={activity.id}>
                          <span className="comment-activity-type">{getCommentActivityLabel(activity.action)}</span>
                          <strong>{activity.actor}</strong>
                          <span className="muted-text">{formatDateTime(activity.at)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
                <div className="inline-actions">
                  <p className="muted-text">{t("Mã tệp đã tải", "Uploaded key")}: {uploadedObjectName}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setBlockType("image");
                      if (uploadedFileUrl) {
                        setBlockContent(uploadedFileUrl);
                      }
                      setActiveTab("content");
                    }}
                  >
                    {t("Chèn block ảnh ngay", "Insert image block now")}
                  </Button>
                </div>
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
