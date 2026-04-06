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

export interface Comment {
  id: string;
  blockId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
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
