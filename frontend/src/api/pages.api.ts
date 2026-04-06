import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type { ApiEnvelope, Page, PageTreeNode } from "../types/api";

interface CreatePageInput {
  title?: string;
  parentId?: string;
  icon?: string;
}

interface UpdatePageInput {
  title?: string;
  icon?: string;
  coverUrl?: string;
}

export const pagesApi = {
  async getTree(workspaceId: string): Promise<PageTreeNode[]> {
    return withApiError(
      http
        .get<ApiEnvelope<PageTreeNode[]>>(`/workspaces/${workspaceId}/pages`)
        .then((res) => unwrap(res.data)),
    );
  },

  async create(workspaceId: string, input: CreatePageInput): Promise<Page> {
    return withApiError(
      http
        .post<ApiEnvelope<Page>>(`/workspaces/${workspaceId}/pages`, input)
        .then((res) => unwrap(res.data)),
    );
  },

  async getById(pageId: string): Promise<Page> {
    return withApiError(
      http.get<ApiEnvelope<Page>>(`/pages/${pageId}`).then((res) => unwrap(res.data)),
    );
  },

  async update(pageId: string, input: UpdatePageInput): Promise<Page> {
    return withApiError(
      http
        .patch<ApiEnvelope<Page>>(`/pages/${pageId}`, input)
        .then((res) => unwrap(res.data)),
    );
  },

  async remove(pageId: string): Promise<void> {
    return withApiError(
      http.delete<ApiEnvelope<unknown>>(`/pages/${pageId}`).then(() => undefined),
    );
  },

  async move(pageId: string, parentId: string | null): Promise<Page> {
    return withApiError(
      http
        .patch<ApiEnvelope<Page>>(`/pages/${pageId}/move`, { parentId })
        .then((res) => unwrap(res.data)),
    );
  },

  async getVersions(pageId: string): Promise<Array<{ id: string; createdAt: string; createdBy: string }>> {
    return withApiError(
      http
        .get<ApiEnvelope<Array<{ id: string; createdAt: string; createdBy: string }>>>(
          `/pages/${pageId}/versions`,
        )
        .then((res) => unwrap(res.data)),
    );
  },

  async restoreVersion(pageId: string, versionId: string): Promise<void> {
    return withApiError(
      http
        .post<ApiEnvelope<unknown>>(`/pages/${pageId}/versions/restore`, { versionId })
        .then(() => undefined),
    );
  },

  async exportMarkdown(pageId: string): Promise<Blob> {
    return withApiError(
      http
        .get(`/pages/${pageId}/export/markdown`, { responseType: "blob" })
        .then((res) => res.data as Blob),
    );
  },
};
