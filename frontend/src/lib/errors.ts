import axios, { AxiosError } from "axios";
import type { ApiErrorEnvelope } from "../types/api";

export class ApiClientError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
  }
}

export function normalizeApiError(error: unknown): ApiClientError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorEnvelope>;
    const statusCode = axiosError.response?.status;
    const message =
      axiosError.response?.data?.message ||
      axiosError.message ||
      "Request failed";

    return new ApiClientError(message, statusCode);
  }

  if (error instanceof Error) {
    return new ApiClientError(error.message);
  }

  return new ApiClientError("Unexpected error");
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}
