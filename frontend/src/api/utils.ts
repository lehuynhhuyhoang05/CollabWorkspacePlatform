import { normalizeApiError } from "../lib/errors";
import type { ApiEnvelope } from "../types/api";

export function unwrap<T>(payload: ApiEnvelope<T>): T {
  return payload.data;
}

export async function withApiError<T>(task: Promise<T>): Promise<T> {
  try {
    return await task;
  } catch (error) {
    throw normalizeApiError(error);
  }
}
