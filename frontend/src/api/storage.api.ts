import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type { ApiEnvelope, UploadResult } from "../types/api";

export const storageApi = {
  async upload(file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    return withApiError(
      http
        .post<ApiEnvelope<UploadResult>>("/storage/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((res) => unwrap(res.data)),
    );
  },

  async remove(objectName: string): Promise<void> {
    const encodedKey = encodeURIComponent(objectName);

    return withApiError(
      http
        .delete<ApiEnvelope<unknown>>(`/storage/${encodedKey}`)
        .then(() => undefined),
    );
  },
};
