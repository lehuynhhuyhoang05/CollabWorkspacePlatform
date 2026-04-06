import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type { ApiEnvelope, Comment } from "../types/api";

export const commentsApi = {
  async list(blockId: string): Promise<Comment[]> {
    return withApiError(
      http
        .get<ApiEnvelope<Comment[]>>(`/blocks/${blockId}/comments`)
        .then((res) => unwrap(res.data)),
    );
  },

  async create(blockId: string, content: string): Promise<Comment> {
    return withApiError(
      http
        .post<ApiEnvelope<Comment>>(`/blocks/${blockId}/comments`, { content })
        .then((res) => unwrap(res.data)),
    );
  },

  async update(commentId: string, content: string): Promise<Comment> {
    return withApiError(
      http
        .patch<ApiEnvelope<Comment>>(`/comments/${commentId}`, { content })
        .then((res) => unwrap(res.data)),
    );
  },

  async remove(commentId: string): Promise<void> {
    return withApiError(
      http
        .delete<ApiEnvelope<unknown>>(`/comments/${commentId}`)
        .then(() => undefined),
    );
  },
};
