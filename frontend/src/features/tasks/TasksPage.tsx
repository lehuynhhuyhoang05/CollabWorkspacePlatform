import { useEffect, useMemo, useState, type CSSProperties, type WheelEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pagesApi } from "../../api/pages.api";
import { googleIntegrationsApi } from "../../api/google-integrations.api";
import { tasksApi, type UpdateTaskInput } from "../../api/tasks.api";
import { workspacesApi } from "../../api/workspaces.api";
import { getErrorMessage } from "../../lib/errors";
import { useLocale } from "../../lib/locale";
import { useToastStore } from "../../store/toast.store";
import type {
  GoogleCalendarEventItem,
  PageTreeNode,
  Task,
  TaskPriority,
  TaskStatus,
} from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Loader } from "../../components/common/Loader";
import { ErrorBanner } from "../../components/common/ErrorBanner";

type TaskViewMode = "table" | "board" | "calendar";
type GoogleCalendarViewMode = "week" | "month";
type AttendeeResponseStatus = "needsAction" | "declined" | "tentative" | "accepted";
type ConflictStrategy = "mark" | "prefer_google" | "prefer_task";

const TASK_VIEW_MODES: TaskViewMode[] = ["table", "board", "calendar"];
const TASK_STATUS_ORDER: TaskStatus[] = ["todo", "inProgress", "blocked", "done"];
const TASK_PRIORITY_ORDER: TaskPriority[] = ["low", "medium", "high", "urgent"];

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toDatetimeLocalInput(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function parseLocalDatetimeInput(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function compareTaskDate(a: Task, b: Task): number {
  const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;

  if (aTime !== bTime) {
    return aTime - bTime;
  }

  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toLocalDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function weekDaysFromAnchor(anchor: Date): Date[] {
  const normalized = startOfLocalDay(anchor);
  const day = normalized.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDays(normalized, mondayOffset);

  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

function monthGridFromAnchor(anchor: Date): Date[] {
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const normalizedFirstDay = startOfLocalDay(firstDay);
  const firstWeekDay = normalizedFirstDay.getDay();
  const mondayOffset = firstWeekDay === 0 ? -6 : 1 - firstWeekDay;
  const gridStart = addDays(normalizedFirstDay, mondayOffset);

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function mergeDateWithEventTime(targetDate: Date, sourceDate: Date): Date {
  const merged = new Date(targetDate);
  merged.setHours(
    sourceDate.getHours(),
    sourceDate.getMinutes(),
    sourceDate.getSeconds(),
    sourceDate.getMilliseconds(),
  );
  return merged;
}

function parseRecurrenceInput(input: string): string[] {
  return input
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function flattenPageTree(nodes: PageTreeNode[], depth = 0): Array<{ id: string; label: string }> {
  const result: Array<{ id: string; label: string }> = [];

  nodes.forEach((node) => {
    const indent = depth > 0 ? `${"  ".repeat(depth)}- ` : "";
    result.push({
      id: node.id,
      label: `${indent}${node.icon || "📄"} ${node.title}`,
    });

    if (node.children.length > 0) {
      result.push(...flattenPageTree(node.children, depth + 1));
    }
  });

  return result;
}

export function TasksPage() {
  const { workspaceId = "" } = useParams();
  const isWorkspaceScope = Boolean(workspaceId);
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const pushToast = useToastStore((state) => state.pushToast);

  const [viewMode, setViewMode] = useState<TaskViewMode>("table");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [parentTaskId, setParentTaskId] = useState("");
  const [relatedPageId, setRelatedPageId] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [creatingEventTaskId, setCreatingEventTaskId] = useState<string | null>(null);
  const [queuingSyncTaskId, setQueuingSyncTaskId] = useState<string | null>(null);
  const [eventKeyword, setEventKeyword] = useState("");
  const [quickMeetingTitle, setQuickMeetingTitle] = useState("");
  const [quickMeetingDescription, setQuickMeetingDescription] = useState("");
  const [quickMeetingDurationMinutes, setQuickMeetingDurationMinutes] = useState(30);
  const [quickMeetingStartAt, setQuickMeetingStartAt] = useState(() => {
    const nextSlot = new Date();
    nextSlot.setMinutes(nextSlot.getMinutes() + 30);
    nextSlot.setSeconds(0, 0);
    return toDatetimeLocalInput(nextSlot);
  });
  const [selectedMeetingWorkspaceId, setSelectedMeetingWorkspaceId] = useState("");
  const [googleCalendarViewMode, setGoogleCalendarViewMode] = useState<GoogleCalendarViewMode>("week");
  const [googleCalendarAnchor, setGoogleCalendarAnchor] = useState<Date>(() =>
    startOfLocalDay(new Date()),
  );
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [reschedulingEventId, setReschedulingEventId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventEditorSummary, setEventEditorSummary] = useState("");
  const [eventEditorDescription, setEventEditorDescription] = useState("");
  const [eventEditorLocation, setEventEditorLocation] = useState("");
  const [eventEditorIsAllDay, setEventEditorIsAllDay] = useState(false);
  const [eventEditorStartAt, setEventEditorStartAt] = useState("");
  const [eventEditorEndAt, setEventEditorEndAt] = useState("");
  const [eventEditorStartDate, setEventEditorStartDate] = useState("");
  const [eventEditorEndDate, setEventEditorEndDate] = useState("");
  const [eventEditorRecurrenceInput, setEventEditorRecurrenceInput] = useState("");
  const [eventEditorAttendeeEmail, setEventEditorAttendeeEmail] = useState("");
  const [eventEditorAttendeeOptional, setEventEditorAttendeeOptional] = useState(false);
  const [eventEditorAttendees, setEventEditorAttendees] = useState<
    Array<{
      email: string;
      displayName?: string;
      optional?: boolean;
      responseStatus?: AttendeeResponseStatus;
    }>
  >([]);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [rsvpDraftByEmail, setRsvpDraftByEmail] = useState<Record<string, AttendeeResponseStatus>>({});
  const [updatingRsvpEmail, setUpdatingRsvpEmail] = useState<string | null>(null);
  const [syncConflictStrategy, setSyncConflictStrategy] = useState<ConflictStrategy>("mark");
  const [calendarZoom, setCalendarZoom] = useState(1);
  const [isAgendaSummaryOpen, setIsAgendaSummaryOpen] = useState(false);

  const statusLabel = (value: TaskStatus) => {
    if (value === "todo") return t("Cần làm", "To do");
    if (value === "inProgress") return t("Đang làm", "In progress");
    if (value === "blocked") return t("Bị chặn", "Blocked");
    return t("Hoàn thành", "Done");
  };

  const priorityLabel = (value: TaskPriority) => {
    if (value === "low") return t("Thấp", "Low");
    if (value === "medium") return t("Trung bình", "Medium");
    if (value === "high") return t("Cao", "High");
    return t("Khẩn", "Urgent");
  };

  const attendeeResponseStatusLabel = (value: AttendeeResponseStatus) => {
    if (value === "needsAction") return t("Chưa phản hồi", "Needs action");
    if (value === "declined") return t("Từ chối", "Declined");
    if (value === "tentative") return t("Tạm chấp nhận", "Tentative");
    return t("Đồng ý", "Accepted");
  };

  const taskListQueryKey = isWorkspaceScope
    ? ["workspace", workspaceId, "tasks"]
    : ["tasks", "my"];

  const workspaceQuery = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspacesApi.getById(workspaceId),
    enabled: isWorkspaceScope,
  });

  const membersQuery = useQuery({
    queryKey: ["workspace", workspaceId, "members"],
    queryFn: () => workspacesApi.listMembers(workspaceId),
    enabled: isWorkspaceScope,
  });

  const pagesQuery = useQuery({
    queryKey: ["workspace", workspaceId, "pages"],
    queryFn: () => pagesApi.getTree(workspaceId),
    enabled: isWorkspaceScope,
    staleTime: 30_000,
  });

  const tasksQuery = useQuery({
    queryKey: taskListQueryKey,
    queryFn: () => (isWorkspaceScope ? tasksApi.listByWorkspace(workspaceId) : tasksApi.listMy()),
  });

  const googleStatusQuery = useQuery({
    queryKey: ["integrations", "google", "status"],
    queryFn: () => googleIntegrationsApi.getStatus(),
    staleTime: 20_000,
  });

  const isGoogleConnected = Boolean(googleStatusQuery.data?.connected);

  const calendarRange = useMemo(() => {
    if (googleCalendarViewMode === "week") {
      const weekDays = weekDaysFromAnchor(googleCalendarAnchor);
      const start = startOfLocalDay(weekDays[0] || new Date());
      const end = addDays(startOfLocalDay(weekDays[6] || start), 1);
      return {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
      };
    }

    const monthDays = monthGridFromAnchor(googleCalendarAnchor);
    const start = startOfLocalDay(monthDays[0] || new Date());
    const end = addDays(startOfLocalDay(monthDays[monthDays.length - 1] || start), 1);

    return {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
    };
  }, [googleCalendarAnchor, googleCalendarViewMode]);

  const eventsTimeMin = calendarRange.timeMin;
  const eventsTimeMax = calendarRange.timeMax;

  const workspaceOptionsForMeeting = useMemo(() => {
    const byWorkspace = new Map<string, string>();

    (tasksQuery.data ?? []).forEach((task) => {
      const id = task.workspaceId || task.workspace?.id;
      if (!id) return;

      if (!byWorkspace.has(id)) {
        byWorkspace.set(id, task.workspace?.name || id);
      }
    });

    return Array.from(byWorkspace.entries()).map(([id, name]) => ({ id, name }));
  }, [tasksQuery.data]);

  const effectiveMeetingWorkspaceId = isWorkspaceScope
    ? workspaceId
    : (selectedMeetingWorkspaceId || workspaceOptionsForMeeting[0]?.id || "");

  const upcomingEventsQuery = useQuery({
    queryKey: [
      "integrations",
      "google",
      "events",
      effectiveMeetingWorkspaceId || "global",
      eventKeyword.trim(),
      eventsTimeMin,
      eventsTimeMax,
    ],
    queryFn: () =>
      googleIntegrationsApi.listCalendarEvents({
        workspaceId: effectiveMeetingWorkspaceId || undefined,
        timeMin: eventsTimeMin,
        timeMax: eventsTimeMax,
        q: eventKeyword.trim() || undefined,
        maxResults: 40,
      }),
    enabled: isGoogleConnected,
    staleTime: 20_000,
  });

  const createTaskMutation = useMutation({
    mutationFn: () =>
      tasksApi.create(workspaceId, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || null,
        parentTaskId: parentTaskId || null,
        relatedPageId: relatedPageId || null,
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      setAssigneeId("");
      setParentTaskId("");
      setRelatedPageId("");
      queryClient.invalidateQueries({ queryKey: taskListQueryKey });
      pushToast({
        kind: "success",
        title: t("Đã tạo task", "Task created"),
        message: t("Task mới đã được tạo trong workspace.", "A new task was added to this workspace."),
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: (params: { taskId: string; payload: UpdateTaskInput }) =>
      tasksApi.update(params.taskId, params.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskListQueryKey });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => tasksApi.remove(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskListQueryKey });
      pushToast({
        kind: "success",
        title: t("Đã xóa task", "Task removed"),
        message: t("Task đã được xóa khỏi danh sách.", "Task has been removed from list."),
      });
    },
  });

  const createCalendarEventMutation = useMutation({
    mutationFn: (taskId: string) =>
      googleIntegrationsApi.createCalendarEvent({
        taskId,
        createMeetLink: true,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskListQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["integrations", "google"] }),
      ]);

      pushToast({
        kind: "success",
        title: t("Đã tạo Google event", "Google event created"),
        message: t(
          "Task đã được gắn event và Meet link (nếu có).",
          "Task is now linked with calendar event and Meet link when available.",
        ),
      });
    },
  });

  const enqueueTaskSyncMutation = useMutation({
    mutationFn: (taskId: string) =>
      googleIntegrationsApi.enqueueTaskSync(taskId, {
        createMeetLink: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["integrations", "google"] });
      pushToast({
        kind: "success",
        title: t("Đã đưa vào queue", "Added to queue"),
        message: t(
          "Task đã được thêm vào hàng đợi sync Google Calendar.",
          "Task has been queued for Google Calendar sync.",
        ),
      });
    },
  });

  const runSyncJobsMutation = useMutation({
    mutationFn: () =>
      googleIntegrationsApi.runSyncJobs({
        workspaceId: isWorkspaceScope ? workspaceId : undefined,
        limit: 20,
      }),
    onSuccess: async (summary) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskListQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["integrations", "google"] }),
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

  const createQuickMeetingMutation = useMutation({
    mutationFn: async () => {
      const startAtIso = parseLocalDatetimeInput(quickMeetingStartAt);
      if (!startAtIso) {
        throw new Error(t("Thời gian bắt đầu không hợp lệ", "Invalid start time"));
      }

      if (!effectiveMeetingWorkspaceId) {
        throw new Error(
          t(
            "Không tìm thấy workspace để tạo lịch họp.",
            "No workspace selected for creating meeting event.",
          ),
        );
      }

      const endAtIso = new Date(
        new Date(startAtIso).getTime() + quickMeetingDurationMinutes * 60_000,
      ).toISOString();

      return googleIntegrationsApi.createCalendarEvent({
        workspaceId: effectiveMeetingWorkspaceId,
        summary: quickMeetingTitle.trim(),
        description: quickMeetingDescription.trim() || undefined,
        startAt: startAtIso,
        endAt: endAtIso,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        createMeetLink: true,
      });
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integrations", "google", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations", "google", "audit"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations", "google", "status"] }),
      ]);

      setQuickMeetingTitle("");
      setQuickMeetingDescription("");

      pushToast({
        kind: "success",
        title: t("Đã tạo lịch họp", "Meeting scheduled"),
        message: result.meetUrl
          ? t(
              `Đã tạo event và Meet link: ${result.meetUrl}`,
              `Created event with Meet link: ${result.meetUrl}`,
            )
          : t(
              "Đã tạo event trên Google Calendar.",
              "Event was created on Google Calendar.",
            ),
      });
    },
  });

  const updateCalendarEventMutation = useMutation({
    mutationFn: (params: {
      eventId: string;
      payload: {
        calendarId?: string;
        expectedEtag?: string;
        summary?: string;
        description?: string;
        location?: string;
        allDay?: boolean;
        startAt?: string;
        endAt?: string;
        startDate?: string;
        endDate?: string;
        recurrence?: string[];
        attendees?: Array<{
          email: string;
          displayName?: string;
          optional?: boolean;
          responseStatus?: AttendeeResponseStatus;
        }>;
      };
    }) => googleIntegrationsApi.updateCalendarEvent(params.eventId, params.payload),
    onSuccess: async (updatedEvent) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integrations", "google", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations", "google", "audit"] }),
      ]);
      setSelectedEventId(updatedEvent.eventId);
      pushToast({
        kind: "success",
        title: t("Đã cập nhật sự kiện", "Event updated"),
        message: t(
          "Thông tin sự kiện đã được lưu lên Google Calendar.",
          "Event changes were saved to Google Calendar.",
        ),
      });
    },
  });

  const updateCalendarEventRsvpMutation = useMutation({
    mutationFn: (params: {
      eventId: string;
      attendeeEmail: string;
      responseStatus: AttendeeResponseStatus;
      calendarId?: string;
      expectedEtag?: string;
    }) =>
      googleIntegrationsApi.updateCalendarEventRsvp(params.eventId, {
        attendeeEmail: params.attendeeEmail,
        responseStatus: params.responseStatus,
        calendarId: params.calendarId,
        expectedEtag: params.expectedEtag,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["integrations", "google", "events"] });
      pushToast({
        kind: "success",
        title: t("Đã cập nhật RSVP", "RSVP updated"),
        message: t(
          "Trạng thái tham dự đã được cập nhật.",
          "Attendee response status has been updated.",
        ),
      });
    },
  });

  const runBidirectionalSyncMutation = useMutation({
    mutationFn: () =>
      googleIntegrationsApi.runBidirectionalSync({
        workspaceId: isWorkspaceScope ? workspaceId : selectedMeetingWorkspaceId || undefined,
        limit: 80,
        conflictStrategy: syncConflictStrategy,
      }),
    onSuccess: async (summary) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integrations", "google"] }),
        queryClient.invalidateQueries({ queryKey: taskListQueryKey }),
      ]);
      pushToast({
        kind: summary.conflicts > 0 ? "info" : "success",
        title: t("Đã chạy sync 2 chiều", "Bidirectional sync completed"),
        message: t(
          `Scanned ${summary.scanned} • Push ${summary.pushedToGoogle} • Pull ${summary.pulledFromGoogle} • Conflict ${summary.conflicts}`,
          `Scanned ${summary.scanned} • Push ${summary.pushedToGoogle} • Pull ${summary.pulledFromGoogle} • Conflict ${summary.conflicts}`,
        ),
      });
    },
  });

  const topError =
    workspaceQuery.error ||
    membersQuery.error ||
    pagesQuery.error ||
    tasksQuery.error ||
    upcomingEventsQuery.error ||
    createTaskMutation.error ||
    updateTaskMutation.error ||
    deleteTaskMutation.error ||
    googleStatusQuery.error ||
    createCalendarEventMutation.error ||
    updateCalendarEventMutation.error ||
    updateCalendarEventRsvpMutation.error ||
    enqueueTaskSyncMutation.error ||
    runSyncJobsMutation.error ||
    runBidirectionalSyncMutation.error ||
    createQuickMeetingMutation.error;

  const tasks = useMemo(() => [...(tasksQuery.data ?? [])].sort(compareTaskDate), [tasksQuery.data]);
  const pageOptions = useMemo(() => flattenPageTree(pagesQuery.data ?? []), [pagesQuery.data]);
  const upcomingEvents = useMemo(
    () => upcomingEventsQuery.data?.items ?? [],
    [upcomingEventsQuery.data],
  );

  const eventLookupById = useMemo(() => {
    const map: Record<string, GoogleCalendarEventItem> = {};
    upcomingEvents.forEach((event) => {
      map[event.eventId] = event;
    });
    return map;
  }, [upcomingEvents]);

  const selectedEvent = useMemo(
    () => (selectedEventId ? eventLookupById[selectedEventId] || null : null),
    [selectedEventId, eventLookupById],
  );

  const calendarZoomPercent = Math.round(calendarZoom * 100);

  const calendarGridStyle = useMemo(
    () => ({ "--calendar-zoom": String(calendarZoom) } as CSSProperties),
    [calendarZoom],
  );

  useEffect(() => {
    if (!selectedEvent) {
      setEventEditorSummary("");
      setEventEditorDescription("");
      setEventEditorLocation("");
      setEventEditorStartAt("");
      setEventEditorEndAt("");
      setEventEditorStartDate("");
      setEventEditorEndDate("");
      setEventEditorRecurrenceInput("");
      setEventEditorAttendees([]);
      setRsvpDraftByEmail({});
      return;
    }

    setEventEditorSummary(selectedEvent.summary || "");
    setEventEditorDescription(selectedEvent.description || "");
    setEventEditorLocation(selectedEvent.location || "");
    setEventEditorIsAllDay(selectedEvent.isAllDay);

    if (selectedEvent.startAt) {
      const startDate = new Date(selectedEvent.startAt);
      if (!Number.isNaN(startDate.getTime())) {
        setEventEditorStartAt(toDatetimeLocalInput(startDate));
      } else {
        setEventEditorStartAt("");
      }
      setEventEditorStartDate(selectedEvent.startAt.slice(0, 10));
    } else {
      setEventEditorStartAt("");
      setEventEditorStartDate("");
    }

    if (selectedEvent.endAt) {
      const endDate = new Date(selectedEvent.endAt);
      if (!Number.isNaN(endDate.getTime())) {
        setEventEditorEndAt(toDatetimeLocalInput(endDate));
      } else {
        setEventEditorEndAt("");
      }
      setEventEditorEndDate(selectedEvent.endAt.slice(0, 10));
    } else {
      setEventEditorEndAt("");
      setEventEditorEndDate("");
    }

    setEventEditorRecurrenceInput((selectedEvent.recurrence || []).join("\n"));
    setEventEditorAttendees(
      selectedEvent.attendees.map((attendee) => ({
        email: attendee.email,
        displayName: attendee.displayName || undefined,
        optional: attendee.optional,
        responseStatus: (attendee.responseStatus || "needsAction") as AttendeeResponseStatus,
      })),
    );
    setRsvpDraftByEmail(
      selectedEvent.attendees.reduce<Record<string, AttendeeResponseStatus>>((acc, attendee) => {
        acc[attendee.email.toLowerCase()] =
          (attendee.responseStatus || "needsAction") as AttendeeResponseStatus;
        return acc;
      }, {}),
    );
  }, [selectedEvent]);

  useEffect(() => {
    if (!selectedEventId) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedEventId(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedEventId]);

  const calendarDays = useMemo(
    () =>
      googleCalendarViewMode === "week"
        ? weekDaysFromAnchor(googleCalendarAnchor)
        : monthGridFromAnchor(googleCalendarAnchor),
    [googleCalendarViewMode, googleCalendarAnchor],
  );

  const googleEventsByDateKey = useMemo(() => {
    const byDay = new Map<string, GoogleCalendarEventItem[]>();

    upcomingEvents.forEach((event) => {
      if (!event.startAt) return;
      const startDate = new Date(event.startAt);
      if (Number.isNaN(startDate.getTime())) return;

      const key = toLocalDateKey(startDate);
      const next = byDay.get(key) ?? [];
      next.push(event);
      byDay.set(key, next);
    });

    byDay.forEach((dayEvents) => {
      dayEvents.sort((a, b) => {
        const aStart = a.startAt ? new Date(a.startAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bStart = b.startAt ? new Date(b.startAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aStart - bStart;
      });
    });

    return byDay;
  }, [upcomingEvents]);

  const googleSyncConflictTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          Boolean(task.googleSyncConflictMessage) || Boolean(task.googleSyncConflictAt),
      ),
    [tasks],
  );

  const calendarHeaderLabel = useMemo(() => {
    if (googleCalendarViewMode === "week") {
      const weekDays = weekDaysFromAnchor(googleCalendarAnchor);
      const start = weekDays[0];
      const end = weekDays[6];
      if (!start || !end) return "";
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }

    return googleCalendarAnchor.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [googleCalendarAnchor, googleCalendarViewMode]);

  const meetingEnabledEventsCount = useMemo(
    () => upcomingEvents.filter((event) => Boolean(event.meetUrl)).length,
    [upcomingEvents],
  );

  const tasksByGoogleEventId = useMemo(() => {
    const map = new Map<string, Task[]>();

    tasks.forEach((task) => {
      if (!task.googleEventId) return;
      const current = map.get(task.googleEventId) ?? [];
      current.push(task);
      map.set(task.googleEventId, current);
    });

    return map;
  }, [tasks]);

  const selectedEventLinkedTasks = useMemo(
    () => (selectedEvent ? tasksByGoogleEventId.get(selectedEvent.eventId) ?? [] : []),
    [selectedEvent, tasksByGoogleEventId],
  );

  const selectedEventPrimaryTask = selectedEventLinkedTasks[0] || null;

  const syncedTasksCount = useMemo(
    () => tasks.filter((task) => Boolean(task.googleEventId)).length,
    [tasks],
  );

  const boardColumns = useMemo(
    () =>
      TASK_STATUS_ORDER.map((statusKey) => ({
        status: statusKey,
        items: tasks.filter((task) => task.status === statusKey),
      })),
    [tasks],
  );

  const taskAssignments = useMemo(() => {
    if (!isWorkspaceScope) {
      return [];
    }

    const summaries = new Map<
      string,
      {
        key: string;
        label: string;
        total: number;
        todo: number;
        inProgress: number;
        blocked: number;
        done: number;
      }
    >();

    tasks.forEach((task) => {
      const key = task.assigneeId || '__unassigned__';
      const label = task.assignee?.name || t('Chưa gán', 'Unassigned');

      const current = summaries.get(key) || {
        key,
        label,
        total: 0,
        todo: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
      };

      current.total += 1;
      if (task.status === 'todo') current.todo += 1;
      if (task.status === 'inProgress') current.inProgress += 1;
      if (task.status === 'blocked') current.blocked += 1;
      if (task.status === 'done') current.done += 1;

      summaries.set(key, current);
    });

    return Array.from(summaries.values()).sort((a, b) => b.total - a.total);
  }, [isWorkspaceScope, tasks, t]);

  const calendarGroups = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    tasks.forEach((task) => {
      const key = task.dueDate ? toDateInputValue(task.dueDate) : "__no_due_date__";
      const next = grouped.get(key) ?? [];
      next.push(task);
      grouped.set(key, next);
    });

    return Array.from(grouped.entries()).sort(([a], [b]) => {
      if (a === "__no_due_date__") return 1;
      if (b === "__no_due_date__") return -1;
      return a.localeCompare(b);
    });
  }, [tasks]);

  const patchTask = async (taskId: string, payload: UpdateTaskInput) => {
    setUpdatingTaskId(taskId);
    try {
      await updateTaskMutation.mutateAsync({ taskId, payload });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const canCreateQuickMeeting = Boolean(
    quickMeetingTitle.trim() &&
      quickMeetingStartAt &&
      effectiveMeetingWorkspaceId &&
      isGoogleConnected,
  );

  const moveGoogleCalendarAnchor = (direction: "prev" | "next") => {
    setGoogleCalendarAnchor((prev) => {
      if (googleCalendarViewMode === "week") {
        return addDays(prev, direction === "next" ? 7 : -7);
      }

      const next = new Date(prev);
      next.setMonth(next.getMonth() + (direction === "next" ? 1 : -1));
      return next;
    });
  };

  const adjustCalendarZoom = (delta: number) => {
    setCalendarZoom((prev) => {
      const next = clampNumber(prev + delta, 0.75, 1.8);
      return Number(next.toFixed(2));
    });
  };

  const handleCalendarWheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;

    event.preventDefault();
    adjustCalendarZoom(event.deltaY < 0 ? 0.08 : -0.08);
  };

  const openEventEditor = (event: GoogleCalendarEventItem) => {
    setSelectedEventId(event.eventId);
  };

  const addEventEditorAttendee = () => {
    const email = eventEditorAttendeeEmail.trim().toLowerCase();
    if (!email) return;

    if (eventEditorAttendees.some((attendee) => attendee.email.toLowerCase() === email)) {
      return;
    }

    setEventEditorAttendees((prev) => [
      ...prev,
      {
        email,
        optional: eventEditorAttendeeOptional,
        responseStatus: "needsAction",
      },
    ]);
    setEventEditorAttendeeEmail("");
    setEventEditorAttendeeOptional(false);
  };

  const removeEventEditorAttendee = (email: string) => {
    setEventEditorAttendees((prev) =>
      prev.filter((attendee) => attendee.email.toLowerCase() !== email.toLowerCase()),
    );
  };

  const saveSelectedEvent = async () => {
    if (!selectedEvent) {
      return;
    }

    const payload: {
      calendarId?: string;
      expectedEtag?: string;
      summary?: string;
      description?: string;
      location?: string;
      allDay?: boolean;
      startAt?: string;
      endAt?: string;
      startDate?: string;
      endDate?: string;
      recurrence?: string[];
      attendees?: Array<{
        email: string;
        displayName?: string;
        optional?: boolean;
        responseStatus?: AttendeeResponseStatus;
      }>;
    } = {
      calendarId: selectedEvent.calendarId,
      expectedEtag: selectedEvent.etag || undefined,
      summary: eventEditorSummary.trim(),
      description: eventEditorDescription.trim() || "",
      location: eventEditorLocation.trim() || "",
      allDay: eventEditorIsAllDay,
      recurrence: parseRecurrenceInput(eventEditorRecurrenceInput),
      attendees: eventEditorAttendees.map((attendee) => ({
        email: attendee.email,
        displayName: attendee.displayName,
        optional: attendee.optional,
        responseStatus: attendee.responseStatus,
      })),
    };

    if (eventEditorIsAllDay) {
      if (!eventEditorStartDate) {
        pushToast({
          kind: "error",
          title: t("Thiếu ngày bắt đầu", "Missing start date"),
          message: t(
            "Bạn cần chọn ngày bắt đầu cho sự kiện cả ngày.",
            "Please choose a start date for the all-day event.",
          ),
        });
        return;
      }

      payload.startDate = eventEditorStartDate;
      payload.endDate =
        eventEditorEndDate ||
        toLocalDateKey(addDays(new Date(`${eventEditorStartDate}T00:00:00`), 1));
    } else {
      const startAtIso = parseLocalDatetimeInput(eventEditorStartAt);
      if (!startAtIso) {
        pushToast({
          kind: "error",
          title: t("Thời gian bắt đầu không hợp lệ", "Invalid start time"),
          message: t(
            "Định dạng thời gian bắt đầu chưa hợp lệ.",
            "Start time format is invalid.",
          ),
        });
        return;
      }

      const endAtIso = parseLocalDatetimeInput(eventEditorEndAt);
      payload.startAt = startAtIso;
      payload.endAt =
        endAtIso || new Date(new Date(startAtIso).getTime() + 60 * 60 * 1000).toISOString();
    }

    setSavingEventId(selectedEvent.eventId);
    try {
      await updateCalendarEventMutation.mutateAsync({
        eventId: selectedEvent.eventId,
        payload,
      });
    } finally {
      setSavingEventId(null);
    }
  };

  const updateAttendeeRsvp = async (
    event: GoogleCalendarEventItem,
    attendeeEmail: string,
  ) => {
    const key = attendeeEmail.toLowerCase();
    const nextStatus = rsvpDraftByEmail[key] || "needsAction";

    setUpdatingRsvpEmail(attendeeEmail);
    try {
      await updateCalendarEventRsvpMutation.mutateAsync({
        eventId: event.eventId,
        attendeeEmail,
        responseStatus: nextStatus,
        calendarId: event.calendarId,
        expectedEtag: event.etag || undefined,
      });
    } finally {
      setUpdatingRsvpEmail(null);
    }
  };

  const rescheduleEventToDay = async (event: GoogleCalendarEventItem, targetDay: Date) => {
    if (!event.startAt) {
      return;
    }

    const start = new Date(event.startAt);
    if (Number.isNaN(start.getTime())) {
      return;
    }

    const payload: {
      calendarId?: string;
      expectedEtag?: string;
      allDay?: boolean;
      startAt?: string;
      endAt?: string;
      startDate?: string;
      endDate?: string;
    } = {
      calendarId: event.calendarId,
      expectedEtag: event.etag || undefined,
      allDay: event.isAllDay,
    };

    if (event.isAllDay) {
      const startDateKey = toLocalDateKey(targetDay);
      const existingEnd = event.endAt ? new Date(event.endAt) : null;
      let durationDays = 1;

      if (existingEnd && !Number.isNaN(existingEnd.getTime())) {
        const startOnly = startOfLocalDay(start);
        const endOnly = startOfLocalDay(existingEnd);
        const diffDays = Math.round((endOnly.getTime() - startOnly.getTime()) / (24 * 60 * 60 * 1000));
        durationDays = Math.max(diffDays, 1);
      }

      const endDateKey = toLocalDateKey(
        addDays(new Date(`${startDateKey}T00:00:00`), durationDays),
      );

      payload.startDate = startDateKey;
      payload.endDate = endDateKey;
    } else {
      const sourceEnd = event.endAt ? new Date(event.endAt) : null;
      const durationMs =
        sourceEnd && !Number.isNaN(sourceEnd.getTime())
          ? Math.max(sourceEnd.getTime() - start.getTime(), 15 * 60 * 1000)
          : 60 * 60 * 1000;

      const targetStart = mergeDateWithEventTime(startOfLocalDay(targetDay), start);
      const targetEnd = new Date(targetStart.getTime() + durationMs);
      payload.startAt = targetStart.toISOString();
      payload.endAt = targetEnd.toISOString();
    }

    setReschedulingEventId(event.eventId);
    try {
      await updateCalendarEventMutation.mutateAsync({
        eventId: event.eventId,
        payload,
      });
    } finally {
      setReschedulingEventId(null);
    }
  };

  const renderTaskAssignee = (task: Task) => {
    if (isWorkspaceScope) {
      return (
        <select
          className="inline-select"
          value={task.assigneeId ?? ""}
          disabled={updateTaskMutation.isPending && updatingTaskId === task.id}
          onChange={async (event) => {
            await patchTask(task.id, {
              assigneeId: event.target.value || null,
            });
          }}
        >
          <option value="">{t("Chưa gán", "Unassigned")}</option>
          {(membersQuery.data ?? []).map((member) => (
            <option key={member.id} value={member.userId}>
              {member.user?.name || member.userId}
            </option>
          ))}
        </select>
      );
    }

    return <span>{task.assignee?.name || t("Chưa gán", "Unassigned")}</span>;
  };

  const relationSummary = (task: Task) => {
    const pieces: string[] = [];

    if (task.parentTask?.title) {
      pieces.push(`${t("Parent", "Parent")}: ${task.parentTask.title}`);
    }

    if (task.relatedPage?.title) {
      pieces.push(`${t("Page", "Page")}: ${task.relatedPage.title}`);
    }

    if (task.rollup && task.rollup.subtaskTotal > 0) {
      pieces.push(
        `${t("Rollup", "Rollup")}: ${task.rollup.subtaskDone}/${task.rollup.subtaskTotal} (${task.rollup.progress}%)`,
      );
    }

    return pieces;
  };

  const renderGoogleMeta = (task: Task) => {
    const hasGoogleData = Boolean(task.googleEventId || task.googleMeetUrl || task.googleCalendarId);
    const matchedEvent = task.googleEventId
      ? eventLookupById[task.googleEventId]
      : undefined;

    if (!hasGoogleData) {
      return <span className="muted-text">{t("Chưa sync", "Not synced")}</span>;
    }

    return (
      <div className="task-google-meta">
        {task.googleEventId ? <p className="muted-text">Event: {task.googleEventId}</p> : null}
        {task.googleCalendarId ? <p className="muted-text">Calendar: {task.googleCalendarId}</p> : null}
        {matchedEvent?.startAt ? (
          <p className="muted-text">
            {t("Lịch", "Schedule")}: {formatDateTime(matchedEvent.startAt)}
          </p>
        ) : null}
        {matchedEvent?.eventUrl ? (
          <a
            href={matchedEvent.eventUrl}
            target="_blank"
            rel="noreferrer"
            className="link-button link-button-sm"
          >
            {t("Mở Event", "Open Event")}
          </a>
        ) : null}
        {task.googleMeetUrl ? (
          <a
            href={task.googleMeetUrl}
            target="_blank"
            rel="noreferrer"
            className="link-button link-button-sm"
          >
            {t("Mở Meet", "Open Meet")}
          </a>
        ) : null}
      </div>
    );
  };

  if (
    tasksQuery.isPending ||
    (isWorkspaceScope && (workspaceQuery.isPending || membersQuery.isPending || pagesQuery.isPending))
  ) {
    return <Loader text={t("Đang tải danh sách task...", "Loading tasks...")} />;
  }

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <p className="chip">{isWorkspaceScope ? t("Task theo workspace", "Workspace tasks") : t("Task của tôi", "My tasks")}</p>
          <h1>
            {isWorkspaceScope
              ? workspaceQuery.data?.name || t("Task", "Tasks")
              : t("My Tasks", "My Tasks")}
          </h1>
        </div>
        {isWorkspaceScope ? (
          <Link to={`/workspaces/${workspaceId}`} className="link-button">
            {t("Quay lại workspace", "Back to Workspace")}
          </Link>
        ) : (
          <Link to="/workspaces" className="link-button">
            {t("Đến danh sách workspace", "Open Workspaces")}
          </Link>
        )}
      </div>

      {topError ? <ErrorBanner message={getErrorMessage(topError)} /> : null}

      {isWorkspaceScope ? (
        <Card>
          <h2 className="card-title">{t("Tạo task", "Create Task")}</h2>
          <div className="task-form-grid">
            <Input
              label={t("Tiêu đề", "Title")}
              placeholder={t("Ví dụ: Chuẩn bị release tuần này", "Example: Prepare this week release")}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Input
              label={t("Mô tả ngắn", "Short description")}
              placeholder={t("Mô tả ngắn về task", "A short description")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <label className="field-root">
              <span className="field-label">{t("Trạng thái", "Status")}</span>
              <select className="field-input" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
                {TASK_STATUS_ORDER.map((statusValue) => (
                  <option key={statusValue} value={statusValue}>{statusLabel(statusValue)}</option>
                ))}
              </select>
            </label>
            <label className="field-root">
              <span className="field-label">{t("Độ ưu tiên", "Priority")}</span>
              <select className="field-input" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
                {TASK_PRIORITY_ORDER.map((priorityValue) => (
                  <option key={priorityValue} value={priorityValue}>{priorityLabel(priorityValue)}</option>
                ))}
              </select>
            </label>
            <label className="field-root">
              <span className="field-label">{t("Hạn chót", "Due date")}</span>
              <input className="field-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label className="field-root">
              <span className="field-label">{t("Người phụ trách", "Assignee")}</span>
              <select className="field-input" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                <option value="">{t("Chưa gán", "Unassigned")}</option>
                {(membersQuery.data ?? []).map((member) => (
                  <option key={member.id} value={member.userId}>
                    {member.user?.name || member.userId}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-root">
              <span className="field-label">{t("Parent task", "Parent task")}</span>
              <select className="field-input" value={parentTaskId} onChange={(event) => setParentTaskId(event.target.value)}>
                <option value="">{t("Không có", "None")}</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-root">
              <span className="field-label">{t("Liên kết page", "Related page")}</span>
              <select className="field-input" value={relatedPageId} onChange={(event) => setRelatedPageId(event.target.value)}>
                <option value="">{t("Không liên kết", "No page link")}</option>
                {pageOptions.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button
            loading={createTaskMutation.isPending}
            disabled={!title.trim()}
            onClick={async () => {
              if (!title.trim()) return;
              await createTaskMutation.mutateAsync();
            }}
          >
            {t("Thêm task", "Add Task")}
          </Button>
        </Card>
      ) : (
        <Card>
          <p className="muted-text">
            {t(
              "Danh sách này gom tất cả task được giao cho bạn ở các workspace. Bạn có thể cập nhật trạng thái/priority trực tiếp.",
              "This list aggregates tasks assigned to you across workspaces. You can update status and priority directly.",
            )}
          </p>
        </Card>
      )}

      <Card>
        <div className="page-header-row">
          <div>
            <h2 className="card-title">{t("Google Calendar Sync", "Google Calendar Sync")}</h2>
            <p className="muted-text">
              {isGoogleConnected
                ? t(
                    "Đã kết nối Google. Bạn có thể tạo event/Meet cho từng task hoặc chạy queue theo batch.",
                    "Google is connected. You can create event/Meet per task or run queue in batch.",
                  )
                : t(
                    "Bạn cần kết nối Google trong Profile để bật sync lịch và Meet link.",
                    "Connect Google in Profile to enable calendar sync and Meet links.",
                  )}
            </p>
          </div>
          <span className={`google-status-pill ${isGoogleConnected ? "status-completed" : "status-pending"}`}>
            {isGoogleConnected ? t("Đã kết nối", "Connected") : t("Chưa kết nối", "Not connected")}
          </span>
        </div>

        <div className="inline-actions">
          {isGoogleConnected ? (
            <Button
              variant="ghost"
              loading={runSyncJobsMutation.isPending}
              onClick={async () => runSyncJobsMutation.mutateAsync()}
            >
              {t("Chạy sync jobs", "Run sync jobs")}
            </Button>
          ) : (
            <Link to="/profile" className="link-button">
              {t("Kết nối Google trong Profile", "Connect Google in Profile")}
            </Link>
          )}
        </div>
      </Card>

      {isWorkspaceScope ? (
        <Card className="task-assignment-card">
          <div className="workspace-list-head">
            <h2 className="card-title">{t('Task được giao theo người', 'Assignments by member')}</h2>
            <span className="task-meta-pill">{taskAssignments.length} {t('nhóm', 'groups')}</span>
          </div>

          <p className="muted-text">
            {t(
              'Assignee có thể tự cập nhật trạng thái/priority/hạn chót task của mình; thay đổi sẽ phản ánh ngay ở cả danh sách workspace và My Tasks.',
              'Assignees can update status/priority/due date for their own tasks; changes are reflected immediately in both workspace and My Tasks views.',
            )}
          </p>

          <ul className="task-assignment-list">
            {taskAssignments.map((assignment) => (
              <li key={assignment.key}>
                <div>
                  <p className="task-title">{assignment.label}</p>
                  <p className="muted-text">
                    {t('Tổng', 'Total')}: {assignment.total}
                  </p>
                </div>
                <div className="task-tag-row">
                  <span className="task-meta-pill">todo: {assignment.todo}</span>
                  <span className="task-meta-pill">doing: {assignment.inProgress}</span>
                  <span className="task-meta-pill">blocked: {assignment.blocked}</span>
                  <span className="task-meta-pill">done: {assignment.done}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="google-hub-card">
        <div className="google-hub-head">
          <div className="google-hub-title">
            <p className="google-hub-chip">{t("Lịch & cuộc họp", "Calendar & Meetings")}</p>
            <h2 className="card-title">{t("Google Agenda & Meetings", "Google Agenda & Meetings")}</h2>
            <p className="muted-text">
              {t(
                "Lịch tuần/tháng kéo-thả, editor attendee + recurring + RSVP, và sync 2 chiều có conflict strategy.",
                "Week/month drag-drop calendar, attendee + recurring + RSVP editor, and bidirectional sync with conflict strategy.",
              )}
            </p>
          </div>

          <div className="google-hub-kpis" role="list" aria-label={t("Tổng quan đồng bộ", "Sync overview")}
          >
            <article className="google-kpi" role="listitem">
              <p className="google-kpi-label">{t("Sự kiện trong khung lịch", "Events in current range")}</p>
              <strong className="google-kpi-value">{upcomingEvents.length}</strong>
            </article>
            <article className="google-kpi" role="listitem">
              <p className="google-kpi-label">{t("Có Meet", "With Meet")}</p>
              <strong className="google-kpi-value">{meetingEnabledEventsCount}</strong>
            </article>
            <article className="google-kpi" role="listitem">
              <p className="google-kpi-label">{t("Task đã sync", "Synced tasks")}</p>
              <strong className="google-kpi-value">{syncedTasksCount}</strong>
            </article>
          </div>
        </div>

        {!isGoogleConnected ? (
          <div className="inline-actions">
            <p className="muted-text">
              {t(
                "Bạn cần kết nối Google trước khi tạo lịch họp hoặc xem agenda.",
                "Connect Google before scheduling meetings or loading agenda.",
              )}
            </p>
            <Link to="/profile" className="link-button">
              {t("Mở Profile để kết nối", "Open Profile to connect")}
            </Link>
          </div>
        ) : (
          <>
            <div className="google-hub-grid">
              <section className="google-meeting-panel">
                <header className="google-panel-head">
                  <h3 className="card-subtitle">{t("Tạo cuộc họp nhanh", "Quick Meeting")}</h3>
                  <p className="muted-text">
                    {t(
                      "Điền thông tin cốt lõi để tạo lịch họp và Meet trong 1 bước.",
                      "Fill only key fields to schedule a meeting and Meet in one step.",
                    )}
                  </p>
                </header>

                {!isWorkspaceScope ? (
                  <label className="field-root">
                    <span className="field-label">{t("Workspace cho cuộc họp", "Meeting workspace")}</span>
                    <select
                      className="field-input"
                      value={selectedMeetingWorkspaceId}
                      onChange={(event) => setSelectedMeetingWorkspaceId(event.target.value)}
                    >
                      <option value="">
                        {workspaceOptionsForMeeting.length > 0
                          ? t("Tự chọn theo task gần nhất", "Auto pick from latest task")
                          : t("Chưa có workspace khả dụng", "No workspace available")}
                      </option>
                      {workspaceOptionsForMeeting.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="google-meeting-form-grid">
                  <Input
                    label={t("Tiêu đề cuộc họp", "Meeting title")}
                    placeholder={t("Ví dụ: Sprint planning", "Example: Sprint planning")}
                    value={quickMeetingTitle}
                    onChange={(event) => setQuickMeetingTitle(event.target.value)}
                  />
                  <Input
                    label={t("Bắt đầu", "Start time")}
                    type="datetime-local"
                    value={quickMeetingStartAt}
                    onChange={(event) => setQuickMeetingStartAt(event.target.value)}
                  />
                  <label className="field-root">
                    <span className="field-label">{t("Thời lượng", "Duration")}</span>
                    <select
                      className="field-input"
                      value={quickMeetingDurationMinutes}
                      onChange={(event) =>
                        setQuickMeetingDurationMinutes(Number(event.target.value) || 30)
                      }
                    >
                      {[15, 30, 45, 60, 90].map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} {t("phút", "minutes")}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field-root">
                  <span className="field-label">{t("Ghi chú", "Notes")}</span>
                  <textarea
                    className="block-editor quick-meeting-notes"
                    rows={3}
                    value={quickMeetingDescription}
                    onChange={(event) => setQuickMeetingDescription(event.target.value)}
                    placeholder={t(
                      "Agenda ngắn cho cuộc họp hoặc thông tin chuẩn bị.",
                      "Short agenda or preparation notes for this meeting.",
                    )}
                  />
                </label>

                <div className="meeting-duration-preset-row" role="group" aria-label={t("Preset thời lượng", "Duration presets")}>
                  {[15, 30, 45, 60].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      className={
                        quickMeetingDurationMinutes === minutes
                          ? "task-view-btn active"
                          : "task-view-btn"
                      }
                      onClick={() => setQuickMeetingDurationMinutes(minutes)}
                    >
                      {minutes}m
                    </button>
                  ))}
                </div>

                <div className="inline-actions meeting-cta-row">
                  <Button
                    className="meeting-primary-btn"
                    loading={createQuickMeetingMutation.isPending}
                    disabled={!canCreateQuickMeeting}
                    onClick={async () => {
                      if (!canCreateQuickMeeting) return;
                      await createQuickMeetingMutation.mutateAsync();
                    }}
                  >
                    {t("Tạo cuộc họp + Meet", "Schedule meeting + Meet")}
                  </Button>

                  <a
                    href="https://calendar.google.com/calendar/u/0/r/week"
                    target="_blank"
                    rel="noreferrer"
                    className="link-button meeting-secondary-link"
                  >
                    {t("Mở Google Calendar", "Open Google Calendar")}
                  </a>
                </div>

                <hr className="divider" />

                <div className="google-sync-controls">
                  <label className="field-root">
                    <span className="field-label">{t("Conflict strategy", "Conflict strategy")}</span>
                    <select
                      className="field-input"
                      value={syncConflictStrategy}
                      onChange={(event) => setSyncConflictStrategy(event.target.value as ConflictStrategy)}
                    >
                      <option value="mark">{t("Mark conflict", "Mark conflict")}</option>
                      <option value="prefer_google">{t("Ưu tiên Google", "Prefer Google")}</option>
                      <option value="prefer_task">{t("Ưu tiên Task", "Prefer Task")}</option>
                    </select>
                  </label>
                  <Button
                    variant="secondary"
                    loading={runBidirectionalSyncMutation.isPending}
                    onClick={async () => {
                      await runBidirectionalSyncMutation.mutateAsync();
                    }}
                  >
                    {t("Chạy sync 2 chiều", "Run bidirectional sync")}
                  </Button>
                </div>

                {googleSyncConflictTasks.length > 0 ? (
                  <div className="google-conflict-panel">
                    <p className="card-subtitle">{t("Task đang conflict", "Tasks with conflicts")}</p>
                    <ul className="google-conflict-list">
                      {googleSyncConflictTasks.slice(0, 6).map((task) => (
                        <li key={task.id}>
                          <p className="task-title">{task.title}</p>
                          <p className="muted-text">{task.googleSyncConflictMessage || t("Conflict detected", "Conflict detected")}</p>
                          {task.googleSyncConflictAt ? (
                            <p className="muted-text">{formatDateTime(task.googleSyncConflictAt)}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <section className="google-agenda-panel">
                <header className="google-panel-head">
                  <h3 className="card-subtitle">{t("Lịch Google", "Google Agenda")}</h3>
                  <p className="muted-text">
                    {t(
                      "Kéo-thả event để dời ngày, bấm event để mở editor và cập nhật RSVP.",
                      "Drag events to move dates, then open event editor to update details and RSVP.",
                    )}
                  </p>
                </header>

                <div className="google-agenda-toolbar">
                  <Input
                    label={t("Tìm trong agenda", "Search agenda")}
                    placeholder={t("Nhập từ khóa cuộc họp, người, chủ đề...", "Search meetings, people, topics...")}
                    value={eventKeyword}
                    onChange={(event) => setEventKeyword(event.target.value)}
                  />
                  <div className="inline-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={upcomingEventsQuery.isFetching}
                      onClick={async () => {
                        await upcomingEventsQuery.refetch();
                      }}
                    >
                      {t("Làm mới", "Refresh")}
                    </Button>
                  </div>
                </div>

                <div className="google-calendar-nav">
                  <div className="task-view-switch" role="group" aria-label={t("Chế độ lịch Google", "Google calendar view mode")}>
                    <button
                      type="button"
                      className={googleCalendarViewMode === "week" ? "task-view-btn active" : "task-view-btn"}
                      onClick={() => setGoogleCalendarViewMode("week")}
                    >
                      {t("Tuần", "Week")}
                    </button>
                    <button
                      type="button"
                      className={googleCalendarViewMode === "month" ? "task-view-btn active" : "task-view-btn"}
                      onClick={() => setGoogleCalendarViewMode("month")}
                    >
                      {t("Tháng", "Month")}
                    </button>
                  </div>
                  <div className="inline-actions">
                    <Button size="sm" variant="ghost" onClick={() => moveGoogleCalendarAnchor("prev")}>
                      {t("Trước", "Prev")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setGoogleCalendarAnchor(startOfLocalDay(new Date()))}
                    >
                      {t("Hôm nay", "Today")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => moveGoogleCalendarAnchor("next")}>
                      {t("Sau", "Next")}
                    </Button>
                    <span className="task-meta-pill">{calendarHeaderLabel}</span>
                  </div>
                </div>

                <div className="calendar-zoom-controls" role="group" aria-label={t("Điều chỉnh độ phóng lịch", "Adjust calendar zoom")}
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => adjustCalendarZoom(-0.1)}
                    disabled={calendarZoom <= 0.75}
                  >
                    {t("Thu nhỏ", "Zoom out")}
                  </Button>
                  <input
                    type="range"
                    min={75}
                    max={180}
                    step={5}
                    value={calendarZoomPercent}
                    onChange={(event) => setCalendarZoom(Number(event.target.value) / 100)}
                    aria-label={t("Mức zoom lịch", "Calendar zoom level")}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => adjustCalendarZoom(0.1)}
                    disabled={calendarZoom >= 1.8}
                  >
                    {t("Phóng to", "Zoom in")}
                  </Button>
                  <button
                    type="button"
                    className="calendar-zoom-reset"
                    onClick={() => setCalendarZoom(1)}
                  >
                    {calendarZoomPercent}%
                  </button>
                  <span className="muted-text calendar-zoom-hint">
                    {t("Mẹo: giữ Ctrl rồi lăn chuột để zoom nhanh", "Tip: hold Ctrl and wheel to zoom quickly")}
                  </span>
                </div>

                {upcomingEventsQuery.isPending ? (
                  <p className="muted-text">{t("Đang tải agenda từ Google...", "Loading agenda from Google...")}</p>
                ) : null}

                {!upcomingEventsQuery.isPending && upcomingEvents.length === 0 ? (
                  <p className="muted-text">
                    {t(
                      "Chưa có sự kiện nào trong khung lịch hiện tại. Bạn có thể tạo cuộc họp ở panel bên trái.",
                      "No events found in the current calendar range. You can schedule one from the panel on the left.",
                    )}
                  </p>
                ) : null}

                {upcomingEvents.length > 0 ? (
                  <div className="google-calendar-stage" onWheel={handleCalendarWheelZoom}>
                    <div
                      className={
                        googleCalendarViewMode === "week"
                          ? "google-calendar-grid week"
                          : "google-calendar-grid month"
                      }
                      style={calendarGridStyle}
                    >
                      {calendarDays.map((day) => {
                        const dayKey = toLocalDateKey(day);
                        const dayEvents = googleEventsByDateKey.get(dayKey) ?? [];
                        const isToday = dayKey === toLocalDateKey(new Date());
                        const isCurrentMonth =
                          day.getMonth() === googleCalendarAnchor.getMonth() &&
                          day.getFullYear() === googleCalendarAnchor.getFullYear();

                        return (
                          <div
                            key={dayKey}
                            className={
                              `google-calendar-day${isToday ? " is-today" : ""}${
                                !isCurrentMonth && googleCalendarViewMode === "month"
                                  ? " is-outside"
                                  : ""
                              }`
                            }
                            onDragOver={(event) => {
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                            }}
                            onDrop={async (event) => {
                              event.preventDefault();
                              const droppedEventId =
                                event.dataTransfer.getData("text/google-event-id") ||
                                draggedEventId;
                              if (!droppedEventId) return;

                              const droppedEvent = eventLookupById[droppedEventId];
                              if (!droppedEvent) return;
                              await rescheduleEventToDay(droppedEvent, day);
                              setDraggedEventId(null);
                            }}
                          >
                            <div className="google-calendar-day-head">
                              <strong>{day.toLocaleDateString(undefined, { weekday: "short" })}</strong>
                              <span>{day.getDate()}</span>
                            </div>
                            <div className="google-calendar-day-body">
                              {dayEvents.length === 0 ? (
                                <span className="muted-text">{t("Trống", "Empty")}</span>
                              ) : (
                                dayEvents.map((event) => {
                                  const timeText = event.isAllDay
                                    ? t("Cả ngày", "All day")
                                    : (event.startAt
                                        ? new Date(event.startAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })
                                        : "--:--");

                                  return (
                                    <button
                                      key={event.eventId}
                                      type="button"
                                      draggable
                                      className={
                                        selectedEventId === event.eventId
                                          ? "google-event-chip active"
                                          : "google-event-chip"
                                      }
                                      onDragStart={(dragEvent) => {
                                        dragEvent.dataTransfer.setData("text/google-event-id", event.eventId);
                                        dragEvent.dataTransfer.effectAllowed = "move";
                                        setDraggedEventId(event.eventId);
                                      }}
                                      onDragEnd={() => setDraggedEventId(null)}
                                      onClick={() => openEventEditor(event)}
                                    >
                                      <span className="google-event-chip-title">{event.summary}</span>
                                      <span className="google-event-chip-time">{timeText}</span>
                                      {reschedulingEventId === event.eventId ? (
                                        <span className="google-event-chip-state">{t("Đang dời...", "Moving...")}</span>
                                      ) : null}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {upcomingEvents.length > 0 ? (
                  <section className="google-agenda-secondary">
                    <div className="integration-list-row">
                      <p className="card-subtitle">
                        {t("Danh sách agenda (phụ)", "Agenda list (secondary)")}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsAgendaSummaryOpen((prev) => !prev)}
                      >
                        {isAgendaSummaryOpen
                          ? t("Thu gọn", "Collapse")
                          : t("Mở danh sách", "Open list")}
                      </Button>
                    </div>

                    {isAgendaSummaryOpen ? (
                      <ul className="google-agenda-list compact mini">
                        {upcomingEvents.slice(0, 4).map((event) => {
                          const statusClass =
                            event.status === "cancelled"
                              ? "status-failed"
                              : event.status === "tentative"
                                ? "status-processing"
                                : "status-success";

                          const timeLabel = event.isAllDay
                            ? t("Cả ngày", "All day")
                            : `${formatDateTime(event.startAt)}${event.endAt ? ` -> ${formatDateTime(event.endAt)}` : ""}`;

                          return (
                            <li key={event.eventId}>
                              <div className="integration-list-row">
                                <button
                                  type="button"
                                  className="text-link-btn"
                                  onClick={() => openEventEditor(event)}
                                >
                                  {event.summary}
                                </button>
                                <span className={`google-status-pill ${statusClass}`}>
                                  {event.status || t("confirmed", "confirmed")}
                                </span>
                              </div>
                              <p className="muted-text">{timeLabel}</p>
                              <p className="muted-text">
                                {t("Attendee", "Attendee")}: {event.attendees.length}
                                {event.recurrence.length > 0 ? ` • ${t("Recurring", "Recurring")}` : ""}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="muted-text">
                        {t(
                          "Danh sách phía dưới chỉ là phần phụ. Ưu tiên chính là lịch ở trên để thao tác kéo-thả và xem theo ngày/tuần.",
                          "The list below is secondary. The main focus is the calendar above for day/week planning and drag-drop.",
                        )}
                      </p>
                    )}
                  </section>
                ) : null}
              </section>
            </div>

            {selectedEvent ? (
              <div
                className="google-event-modal-backdrop"
                onClick={() => setSelectedEventId(null)}
                role="presentation"
              >
              <section
                className="google-event-editor google-event-modal"
                role="dialog"
                aria-modal="true"
                aria-label={t("Chi tiết sự kiện", "Event details")}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="integration-list-row">
                  <h3 className="card-subtitle">{t("Event Editor", "Event Editor")}</h3>
                  <div className="inline-actions">
                    {selectedEvent.eventUrl ? (
                      <a
                        href={selectedEvent.eventUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="link-button link-button-sm"
                      >
                        {t("Mở Event", "Open Event")}
                      </a>
                    ) : null}
                    {selectedEvent.meetUrl ? (
                      <a
                        href={selectedEvent.meetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="link-button link-button-sm"
                      >
                        {t("Vào Meet", "Join Meet")}
                      </a>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedEventId(null)}
                    >
                      {t("Đóng editor", "Close editor")}
                    </Button>
                  </div>
                </div>

                <ul className="google-event-quick-meta" role="list">
                  <li>
                    <span>{t("Thời gian", "When")}</span>
                    <strong>
                      {selectedEvent.isAllDay
                        ? t("Cả ngày", "All day")
                        : `${formatDateTime(selectedEvent.startAt)}${selectedEvent.endAt ? ` -> ${formatDateTime(selectedEvent.endAt)}` : ""}`}
                    </strong>
                  </li>
                  <li>
                    <span>{t("Trạng thái", "Status")}</span>
                    <strong>{selectedEvent.status || t("confirmed", "confirmed")}</strong>
                  </li>
                  <li>
                    <span>{t("Attendees", "Attendees")}</span>
                    <strong>{selectedEvent.attendees.length}</strong>
                  </li>
                  <li>
                    <span>{t("Recurring", "Recurring")}</span>
                    <strong>{selectedEvent.recurrence.length > 0 ? t("Có", "Yes") : t("Không", "No")}</strong>
                  </li>
                  <li>
                    <span>{t("Task liên kết", "Linked task")}</span>
                    <strong>
                      {selectedEventPrimaryTask ? (
                        <Link
                          to={`/workspaces/${selectedEventPrimaryTask.workspaceId}/tasks`}
                          className="google-event-task-link"
                        >
                          {selectedEventPrimaryTask.title}
                        </Link>
                      ) : (
                        t("Không có", "None")
                      )}
                    </strong>
                  </li>
                  <li>
                    <span>{t("Người phụ trách", "Assignee")}</span>
                    <strong>
                      {selectedEventPrimaryTask
                        ? selectedEventPrimaryTask.assignee?.name || t("Chưa gán", "Unassigned")
                        : t("Không có", "None")}
                    </strong>
                  </li>
                </ul>

                <div className="google-event-editor-grid">
                  <Input
                    label={t("Tiêu đề", "Summary")}
                    value={eventEditorSummary}
                    onChange={(event) => setEventEditorSummary(event.target.value)}
                  />
                  <Input
                    label={t("Địa điểm", "Location")}
                    value={eventEditorLocation}
                    onChange={(event) => setEventEditorLocation(event.target.value)}
                  />
                  <label className="field-root">
                    <span className="field-label">{t("Mô tả", "Description")}</span>
                    <textarea
                      className="block-editor"
                      rows={3}
                      value={eventEditorDescription}
                      onChange={(event) => setEventEditorDescription(event.target.value)}
                    />
                  </label>
                  <label className="field-root">
                    <span className="field-label">{t("Lặp lại (RRULE mỗi dòng)", "Recurring (RRULE per line)")}</span>
                    <textarea
                      className="block-editor"
                      rows={3}
                      value={eventEditorRecurrenceInput}
                      onChange={(event) => setEventEditorRecurrenceInput(event.target.value)}
                      placeholder="RRULE:FREQ=WEEKLY;BYDAY=MO"
                    />
                  </label>
                </div>

                <div className="inline-actions">
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={eventEditorIsAllDay}
                      onChange={(event) => setEventEditorIsAllDay(event.target.checked)}
                    />
                    <span>{t("Sự kiện cả ngày", "All-day event")}</span>
                  </label>
                </div>

                {eventEditorIsAllDay ? (
                  <div className="google-event-editor-grid compact">
                    <Input
                      label={t("Ngày bắt đầu", "Start date")}
                      type="date"
                      value={eventEditorStartDate}
                      onChange={(event) => setEventEditorStartDate(event.target.value)}
                    />
                    <Input
                      label={t("Ngày kết thúc", "End date (exclusive)")}
                      type="date"
                      value={eventEditorEndDate}
                      onChange={(event) => setEventEditorEndDate(event.target.value)}
                    />
                  </div>
                ) : (
                  <div className="google-event-editor-grid compact">
                    <Input
                      label={t("Bắt đầu", "Start")}
                      type="datetime-local"
                      value={eventEditorStartAt}
                      onChange={(event) => setEventEditorStartAt(event.target.value)}
                    />
                    <Input
                      label={t("Kết thúc", "End")}
                      type="datetime-local"
                      value={eventEditorEndAt}
                      onChange={(event) => setEventEditorEndAt(event.target.value)}
                    />
                  </div>
                )}

                <div className="google-attendees-editor">
                  <h4 className="card-subtitle">{t("Attendees", "Attendees")}</h4>

                  <div className="google-attendee-add-row">
                    <Input
                      label={t("Email attendee", "Attendee email")}
                      type="email"
                      value={eventEditorAttendeeEmail}
                      onChange={(event) => setEventEditorAttendeeEmail(event.target.value)}
                      placeholder="member@example.com"
                    />
                    <label className="field-checkbox">
                      <input
                        type="checkbox"
                        checked={eventEditorAttendeeOptional}
                        onChange={(event) => setEventEditorAttendeeOptional(event.target.checked)}
                      />
                      <span>{t("Optional", "Optional")}</span>
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={addEventEditorAttendee}
                    >
                      {t("Thêm attendee", "Add attendee")}
                    </Button>
                  </div>

                  <ul className="google-attendee-list">
                    {eventEditorAttendees.map((attendee) => {
                      const attendeeKey = attendee.email.toLowerCase();
                      const currentRsvp = rsvpDraftByEmail[attendeeKey] || "needsAction";
                      return (
                        <li key={attendee.email}>
                          <div>
                            <p className="task-title">{attendee.email}</p>
                            <p className="muted-text">
                              {attendee.optional ? t("Optional", "Optional") : t("Required", "Required")}
                            </p>
                          </div>
                          <div className="inline-actions">
                            <select
                              className="inline-select"
                              value={currentRsvp}
                              onChange={(event) => {
                                setRsvpDraftByEmail((prev) => ({
                                  ...prev,
                                  [attendeeKey]: event.target.value as AttendeeResponseStatus,
                                }));
                                setEventEditorAttendees((prev) =>
                                  prev.map((item) =>
                                    item.email.toLowerCase() === attendeeKey
                                      ? {
                                          ...item,
                                          responseStatus: event.target.value as AttendeeResponseStatus,
                                        }
                                      : item,
                                  ),
                                );
                              }}
                            >
                              {(["needsAction", "declined", "tentative", "accepted"] as AttendeeResponseStatus[]).map((status) => (
                                <option key={status} value={status}>
                                  {attendeeResponseStatusLabel(status)}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={
                                updatingRsvpEmail === attendee.email &&
                                updateCalendarEventRsvpMutation.isPending
                              }
                              onClick={async () => {
                                await updateAttendeeRsvp(selectedEvent, attendee.email);
                              }}
                            >
                              {t("RSVP", "RSVP")}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => removeEventEditorAttendee(attendee.email)}
                            >
                              {t("Xóa", "Remove")}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="inline-actions">
                  <Button
                    loading={savingEventId === selectedEvent.eventId && updateCalendarEventMutation.isPending}
                    disabled={!eventEditorSummary.trim()}
                    onClick={async () => {
                      await saveSelectedEvent();
                    }}
                  >
                    {t("Lưu Event", "Save event")}
                  </Button>
                  <span className="muted-text">
                    ETag: {selectedEvent.etag || "-"} • {t("Updated", "Updated")}: {formatDateTime(selectedEvent.updatedAt)}
                  </span>
                </div>
              </section>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <div className="task-view-switch" role="group" aria-label={t("Chọn kiểu hiển thị task", "Select task view mode")}>
          {TASK_VIEW_MODES.map((mode) => (
            <button
              type="button"
              key={mode}
              className={viewMode === mode ? "task-view-btn active" : "task-view-btn"}
              onClick={() => setViewMode(mode)}
            >
              {mode === "table"
                ? t("Bảng", "Table")
                : mode === "board"
                  ? t("Board", "Board")
                  : t("Lịch", "Calendar")}
            </button>
          ))}
        </div>

        {tasks.length === 0 ? (
          <p className="muted-text">{t("Chưa có task nào.", "No tasks yet.")}</p>
        ) : null}

        {tasks.length > 0 && viewMode === "table" ? (
          <table className="data-table">
            <caption className="sr-only">{t("Danh sách tasks", "Tasks list")}</caption>
            <thead>
              <tr>
                <th>{t("Task", "Task")}</th>
                <th>{t("Trạng thái", "Status")}</th>
                <th>{t("Ưu tiên", "Priority")}</th>
                <th>{t("Hạn chót", "Due date")}</th>
                <th>{t("Phụ trách", "Assignee")}</th>
                <th>{t("Liên kết/Rollup", "Relations/Rollup")}</th>
                <th>{t("Calendar/Meet", "Calendar/Meet")}</th>
                {!isWorkspaceScope ? <th>{t("Workspace", "Workspace")}</th> : null}
                <th>{t("Hành động", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <p className="task-title">{task.title}</p>
                    {task.description ? <p className="muted-text">{task.description}</p> : null}
                  </td>
                  <td>
                    <select
                      className="inline-select"
                      value={task.status}
                      disabled={updateTaskMutation.isPending && updatingTaskId === task.id}
                      onChange={async (event) => {
                        await patchTask(task.id, {
                          status: event.target.value as TaskStatus,
                        });
                      }}
                    >
                      {TASK_STATUS_ORDER.map((statusValue) => (
                        <option key={statusValue} value={statusValue}>{statusLabel(statusValue)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="inline-select"
                      value={task.priority}
                      disabled={updateTaskMutation.isPending && updatingTaskId === task.id}
                      onChange={async (event) => {
                        await patchTask(task.id, {
                          priority: event.target.value as TaskPriority,
                        });
                      }}
                    >
                      {TASK_PRIORITY_ORDER.map((priorityValue) => (
                        <option key={priorityValue} value={priorityValue}>{priorityLabel(priorityValue)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="inline-select"
                      type="date"
                      value={toDateInputValue(task.dueDate)}
                      disabled={updateTaskMutation.isPending && updatingTaskId === task.id}
                      onChange={async (event) => {
                        await patchTask(task.id, {
                          dueDate: event.target.value || null,
                        });
                      }}
                    />
                  </td>
                  <td>{renderTaskAssignee(task)}</td>
                  <td>
                    {isWorkspaceScope ? (
                      <div className="task-relation-editor">
                        <select
                          className="inline-select"
                          value={task.parentTaskId ?? ""}
                          disabled={updateTaskMutation.isPending && updatingTaskId === task.id}
                          onChange={async (event) => {
                            await patchTask(task.id, {
                              parentTaskId: event.target.value || null,
                            });
                          }}
                        >
                          <option value="">{t("Parent: Không có", "Parent: none")}</option>
                          {tasks.filter((candidate) => candidate.id !== task.id).map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.title}
                            </option>
                          ))}
                        </select>
                        <select
                          className="inline-select"
                          value={task.relatedPageId ?? ""}
                          disabled={updateTaskMutation.isPending && updatingTaskId === task.id}
                          onChange={async (event) => {
                            await patchTask(task.id, {
                              relatedPageId: event.target.value || null,
                            });
                          }}
                        >
                          <option value="">{t("Page: Không liên kết", "Page: no link")}</option>
                          {pageOptions.map((page) => (
                            <option key={page.id} value={page.id}>
                              {page.label}
                            </option>
                          ))}
                        </select>
                        {relationSummary(task).length > 0 ? (
                          <p className="muted-text">{relationSummary(task).join(" • ")}</p>
                        ) : null}
                        {task.relatedPageId ? (
                          <Link to={`/pages/${task.relatedPageId}`} className="link-button link-button-sm">
                            {t("Mở page", "Open page")}
                          </Link>
                        ) : null}
                      </div>
                    ) : relationSummary(task).length > 0 ? (
                      <p className="muted-text">{relationSummary(task).join(" • ")}</p>
                    ) : (
                      <span className="muted-text">-</span>
                    )}
                  </td>
                  <td>{renderGoogleMeta(task)}</td>
                  {!isWorkspaceScope ? <td>{task.workspace?.name || "-"}</td> : null}
                  <td>
                    <div className="task-action-stack">
                      {isGoogleConnected ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={
                              creatingEventTaskId === task.id &&
                              createCalendarEventMutation.isPending
                            }
                            disabled={Boolean(creatingEventTaskId && creatingEventTaskId !== task.id)}
                            onClick={async () => {
                              setCreatingEventTaskId(task.id);
                              try {
                                await createCalendarEventMutation.mutateAsync(task.id);
                              } finally {
                                setCreatingEventTaskId(null);
                              }
                            }}
                          >
                            {task.googleEventId
                              ? t("Tạo lại Event+Meet", "Recreate Event+Meet")
                              : t("Tạo Event+Meet", "Create Event+Meet")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={
                              queuingSyncTaskId === task.id &&
                              enqueueTaskSyncMutation.isPending
                            }
                            disabled={Boolean(queuingSyncTaskId && queuingSyncTaskId !== task.id)}
                            onClick={async () => {
                              setQueuingSyncTaskId(task.id);
                              try {
                                await enqueueTaskSyncMutation.mutateAsync(task.id);
                              } finally {
                                setQueuingSyncTaskId(null);
                              }
                            }}
                          >
                            {t("Queue Sync", "Queue Sync")}
                          </Button>
                        </>
                      ) : (
                        <Link to="/profile" className="link-button link-button-sm">
                          {t("Kết nối Google", "Connect Google")}
                        </Link>
                      )}

                      {isWorkspaceScope ? (
                        <Button
                          variant="danger"
                          size="sm"
                          loading={deletingTaskId === task.id && deleteTaskMutation.isPending}
                          disabled={Boolean(deletingTaskId && deletingTaskId !== task.id)}
                          onClick={async () => {
                            const confirmed = window.confirm(
                              t(
                                "Bạn có chắc muốn xóa task này?",
                                "Are you sure you want to delete this task?",
                              ),
                            );
                            if (!confirmed) return;

                            setDeletingTaskId(task.id);
                            try {
                              await deleteTaskMutation.mutateAsync(task.id);
                            } finally {
                              setDeletingTaskId(null);
                            }
                          }}
                        >
                          {t("Xóa", "Delete")}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tasks.length > 0 && viewMode === "board" ? (
          <div className="task-board-grid">
            {boardColumns.map((column) => (
              <section key={column.status} className="task-board-column">
                <h3>{statusLabel(column.status)} ({column.items.length})</h3>
                <ul className="task-board-list">
                  {column.items.map((task) => (
                    <li key={task.id} className="task-board-card">
                      <p className="task-title">{task.title}</p>
                      <div className="task-tag-row">
                        <span className={`task-priority-pill priority-${task.priority}`}>{priorityLabel(task.priority)}</span>
                        <span className="task-meta-pill">
                          {task.dueDate ? toDateInputValue(task.dueDate) : t("Không deadline", "No due")}
                        </span>
                      </div>
                      <p className="muted-text">
                        {t("Phụ trách", "Assignee")}: {task.assignee?.name || t("Chưa gán", "Unassigned")}
                      </p>
                      {relationSummary(task).length > 0 ? (
                        <p className="muted-text">{relationSummary(task).join(" • ")}</p>
                      ) : null}
                      {task.googleEventId || task.googleMeetUrl || task.googleCalendarId ? renderGoogleMeta(task) : null}
                      {!isWorkspaceScope ? (
                        <p className="muted-text">
                          {t("Workspace", "Workspace")}: {task.workspace?.name || "-"}
                        </p>
                      ) : null}
                      <label className="field-root">
                        <span className="field-label">{t("Đổi trạng thái", "Move status")}</span>
                        <select
                          className="field-input"
                          value={task.status}
                          disabled={updateTaskMutation.isPending && updatingTaskId === task.id}
                          onChange={async (event) => {
                            await patchTask(task.id, {
                              status: event.target.value as TaskStatus,
                            });
                          }}
                        >
                          {TASK_STATUS_ORDER.map((statusValue) => (
                            <option key={statusValue} value={statusValue}>{statusLabel(statusValue)}</option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {tasks.length > 0 && viewMode === "calendar" ? (
          <div className="task-calendar-grid">
            {calendarGroups.map(([groupKey, groupTasks]) => (
              <section key={groupKey} className="task-calendar-group">
                <h3>
                  {groupKey === "__no_due_date__"
                    ? t("Không có deadline", "No due date")
                    : groupKey}
                </h3>
                <ul className="task-calendar-list">
                  {groupTasks.map((task) => (
                    <li key={task.id}>
                      <div>
                        <p className="task-title">{task.title}</p>
                        <p className="muted-text">
                          {statusLabel(task.status)} • {priorityLabel(task.priority)}
                          {task.assignee?.name ? ` • ${task.assignee.name}` : ""}
                          {!isWorkspaceScope ? ` • ${task.workspace?.name || "-"}` : ""}
                        </p>
                        {relationSummary(task).length > 0 ? (
                          <p className="muted-text">{relationSummary(task).join(" • ")}</p>
                        ) : null}
                        {task.googleEventId || task.googleMeetUrl || task.googleCalendarId ? renderGoogleMeta(task) : null}
                      </div>
                      <select
                        className="inline-select"
                        value={task.status}
                        disabled={updateTaskMutation.isPending && updatingTaskId === task.id}
                        onChange={async (event) => {
                          await patchTask(task.id, {
                            status: event.target.value as TaskStatus,
                          });
                        }}
                      >
                        {TASK_STATUS_ORDER.map((statusValue) => (
                          <option key={statusValue} value={statusValue}>{statusLabel(statusValue)}</option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export default TasksPage;
