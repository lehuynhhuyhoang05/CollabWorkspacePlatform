import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type { ApiEnvelope, SearchResult } from "../types/api";

export const searchApi = {
  async search(workspaceId: string, query: string, limit = 20): Promise<SearchResult[]> {
    return withApiError(
      http
        .get<ApiEnvelope<SearchResult[]>>(`/workspaces/${workspaceId}/search`, {
          params: { q: query, limit },
        })
        .then((res) => unwrap(res.data)),
    );
  },
};
