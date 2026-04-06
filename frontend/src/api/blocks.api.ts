import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type { ApiEnvelope, Block } from "../types/api";

interface CreateBlockInput {
  type: string;
  content?: string;
  sortOrder?: number;
}

interface UpdateBlockInput {
  type?: string;
  content?: string;
}

export const blocksApi = {
  async list(pageId: string): Promise<Block[]> {
    return withApiError(
      http
        .get<ApiEnvelope<Block[]>>(`/pages/${pageId}/blocks`)
        .then((res) => unwrap(res.data)),
    );
  },

  async create(pageId: string, input: CreateBlockInput): Promise<Block> {
    return withApiError(
      http
        .post<ApiEnvelope<Block>>(`/pages/${pageId}/blocks`, input)
        .then((res) => unwrap(res.data)),
    );
  },

  async update(blockId: string, input: UpdateBlockInput): Promise<Block> {
    return withApiError(
      http
        .patch<ApiEnvelope<Block>>(`/blocks/${blockId}`, input)
        .then((res) => unwrap(res.data)),
    );
  },

  async remove(blockId: string): Promise<void> {
    return withApiError(
      http.delete<ApiEnvelope<unknown>>(`/blocks/${blockId}`).then(() => undefined),
    );
  },

  async reorder(pageId: string, blockIds: string[]): Promise<void> {
    return withApiError(
      http
        .patch<ApiEnvelope<unknown>>(`/blocks/${pageId}/move`, { blockIds })
        .then(() => undefined),
    );
  },
};
