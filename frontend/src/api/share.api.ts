import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type { ApiEnvelope, ShareLink, SharedPagePayload } from "../types/api";

export const shareApi = {
  async create(pageId: string, permission: "view" | "edit" = "view"): Promise<ShareLink> {
    return withApiError(
      http
        .post<ApiEnvelope<ShareLink>>(`/pages/${pageId}/share`, { permission })
        .then((res) => unwrap(res.data)),
    );
  },

  async resolve(token: string): Promise<SharedPagePayload> {
    return withApiError(
      http
        .get<ApiEnvelope<SharedPagePayload>>(`/share/${token}`)
        .then((res) => unwrap(res.data)),
    );
  },
};
