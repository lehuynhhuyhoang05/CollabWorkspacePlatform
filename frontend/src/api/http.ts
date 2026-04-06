import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { env } from "../lib/env";
import { normalizeApiError } from "../lib/errors";
import { useAuthStore } from "../store/auth.store";
import type { ApiEnvelope, TokenPair } from "../types/api";

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const authFreePaths = ["/auth/login", "/auth/register", "/auth/refresh", "/share/"];

function isAuthFreeRequest(url?: string): boolean {
  if (!url) return false;
  return authFreePaths.some((path) => url.includes(path));
}

const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
});

const refreshClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, clearAuth } = useAuthStore.getState();
  if (!refreshToken) {
    clearAuth();
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<ApiEnvelope<TokenPair>>("/auth/refresh", { refreshToken })
      .then((response) => {
        const nextTokens = response.data.data;
        setTokens(nextTokens.accessToken, nextTokens.refreshToken);
        return nextTokens.accessToken;
      })
      .catch(() => {
        clearAuth();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  if (token && !isAuthFreeRequest(config.url)) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

http.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalConfig = error.config as RetriableRequestConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalConfig &&
      !originalConfig._retry &&
      !isAuthFreeRequest(originalConfig.url)
    ) {
      originalConfig._retry = true;

      const accessToken = await refreshAccessToken();
      if (accessToken) {
        originalConfig.headers = originalConfig.headers ?? {};
        originalConfig.headers.Authorization = `Bearer ${accessToken}`;
        return http.request(originalConfig);
      }
    }

    return Promise.reject(normalizeApiError(error));
  },
);

export { http };
