export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  statusCode: number;
  message: string;
  path: string;
  timestamp: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type WorkspaceRole = "owner" | "editor" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user?: User;
}

export interface PageTreeNode {
  id: string;
  title: string;
  icon: string | null;
  sortOrder: number;
  children: PageTreeNode[];
}

export interface Block {
  id: string;
  pageId: string;
  type: string;
  content: string | null;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  workspaceId: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  isDeleted: boolean;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  blocks?: Block[];
}

export interface PageVersion {
  id: string;
  pageId: string;
  createdBy: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  blockId: string;
  userId: string;
  content: string;
  isResolved: boolean;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  reopenedByUserId: string | null;
  reopenedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  resolvedByUser?: User | null;
  reopenedByUser?: User | null;
}

export interface SearchResult {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  matchType: "title" | "content";
  snippet: string;
}

export interface ShareLink {
  token: string;
  permission: "view" | "edit";
  createdAt: string;
}

export interface SharedPagePayload {
  permission: "view" | "edit";
  page: {
    id: string;
    title: string;
    icon: string | null;
    coverUrl: string | null;
    updatedAt: string;
    blocks: Block[];
  };
}

export interface UploadResult {
  objectName: string;
  url: string;
}

export type TaskStatus = "todo" | "inProgress" | "done" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskRollup {
  subtaskTotal: number;
  subtaskDone: number;
  progress: number;
}

export interface TaskReference {
  id: string;
  title: string;
}

export interface TaskRelatedPage {
  id: string;
  title: string;
  icon: string | null;
}

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
  parentTaskId: string | null;
  relatedPageId: string | null;
  googleEventId: string | null;
  googleCalendarId: string | null;
  googleMeetUrl: string | null;
  googleEventEtag: string | null;
  googleEventUpdatedAt: string | null;
  googleTaskLastSyncedAt: string | null;
  googleLastPulledAt: string | null;
  googleSyncConflictAt: string | null;
  googleSyncConflictMessage: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
  creator?: User | null;
  workspace?: Workspace | null;
  parentTask?: TaskReference | null;
  relatedPage?: TaskRelatedPage | null;
  rollup?: TaskRollup;
}

export interface GoogleOauthUrlPayload {
  url: string;
  redirectUri: string;
  scopes: string[];
}

export interface GoogleIntegrationStatus {
  connected: boolean;
  googleEmail: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  lastSyncAt: string | null;
}

export interface GoogleCalendarEventResult {
  eventId: string;
  calendarId: string;
  eventUrl: string | null;
  meetUrl: string | null;
  syncedTaskId: string | null;
}

export type GoogleAttendeeResponseStatus =
  | "needsAction"
  | "declined"
  | "tentative"
  | "accepted";

export interface GoogleCalendarEventAttendee {
  email: string;
  displayName: string | null;
  optional: boolean;
  responseStatus: string | null;
  self: boolean;
}

export interface GoogleCalendarEventItem {
  eventId: string;
  etag: string | null;
  updatedAt: string | null;
  summary: string;
  description: string | null;
  status: string | null;
  startAt: string | null;
  endAt: string | null;
  isAllDay: boolean;
  eventUrl: string | null;
  meetUrl: string | null;
  location: string | null;
  attendees: GoogleCalendarEventAttendee[];
  recurrence: string[];
  calendarId: string;
}

export interface GoogleBidirectionalSyncSummary {
  scanned: number;
  pushedToGoogle: number;
  pulledFromGoogle: number;
  conflicts: number;
  skipped: number;
  failed: number;
  strategy: "mark" | "prefer_google" | "prefer_task";
}

export interface GoogleCalendarEventsPayload {
  calendarId: string;
  items: GoogleCalendarEventItem[];
  nextPageToken: string | null;
  fetchedAt: string;
}

export type GoogleSyncJobStatus =
  | "pending"
  | "processing"
  | "retrying"
  | "completed"
  | "failed";

export interface GoogleSyncJob {
  id: string;
  userId: string;
  workspaceId: string | null;
  taskId: string | null;
  type: string;
  payload: string;
  status: GoogleSyncJobStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  lastError: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  task?: Task | null;
}

export interface GoogleAuditLog {
  id: string;
  userId: string | null;
  workspaceId: string | null;
  jobId: string | null;
  provider: string;
  action: string;
  status: string;
  message: string;
  requestPayload: string | null;
  responsePayload: string | null;
  createdAt: string;
}

export type NotificationType = "mention" | "taskAssigned" | "deadlineReminder";

export interface NotificationItem {
  id: string;
  workspaceId: string | null;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdBy: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  creator?: User | null;
}

export interface WorkspaceActivity {
  id: string;
  workspaceId: string;
  actorUserId: string;
  type: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  actor?: User | null;
}
