import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type { ApiEnvelope, TokenPair, User } from "../types/api";

interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface RefreshInput {
  refreshToken: string;
}

interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string;
}

export const authApi = {
  async register(input: RegisterInput): Promise<TokenPair> {
    return withApiError(
      http
        .post<ApiEnvelope<TokenPair>>("/auth/register", input)
        .then((res) => unwrap(res.data)),
    );
  },

  async login(input: LoginInput): Promise<TokenPair> {
    return withApiError(
      http
        .post<ApiEnvelope<TokenPair>>("/auth/login", input)
        .then((res) => unwrap(res.data)),
    );
  },

  async refresh(input: RefreshInput): Promise<TokenPair> {
    return withApiError(
      http
        .post<ApiEnvelope<TokenPair>>("/auth/refresh", input)
        .then((res) => unwrap(res.data)),
    );
  },

  async me(): Promise<User> {
    return withApiError(
      http.get<ApiEnvelope<User>>("/auth/me").then((res) => unwrap(res.data)),
    );
  },

  async logout(): Promise<{ message: string }> {
    return withApiError(
      http
        .post<ApiEnvelope<{ message: string }>>("/auth/logout")
        .then((res) => unwrap(res.data)),
    );
  },

  async updateProfile(input: UpdateProfileInput): Promise<User> {
    return withApiError(
      http
        .patch<ApiEnvelope<User>>("/users/me", input)
        .then((res) => unwrap(res.data)),
    );
  },
};
