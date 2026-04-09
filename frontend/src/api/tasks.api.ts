import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type { ApiEnvelope, Task, TaskPriority, TaskStatus } from "../types/api";

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assigneeId?: string | null;
  parentTaskId?: string | null;
  relatedPageId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
  parentTaskId?: string | null;
  relatedPageId?: string | null;
}

export const tasksApi = {
  async listByWorkspace(workspaceId: string): Promise<Task[]> {
    return withApiError(
      http
        .get<ApiEnvelope<Task[]>>(`/workspaces/${workspaceId}/tasks`)
        .then((res) => unwrap(res.data)),
    );
  },

  async listMy(): Promise<Task[]> {
    return withApiError(
      http
        .get<ApiEnvelope<Task[]>>("/tasks/my")
        .then((res) => unwrap(res.data)),
    );
  },

  async create(workspaceId: string, input: CreateTaskInput): Promise<Task> {
    return withApiError(
      http
        .post<ApiEnvelope<Task>>(`/workspaces/${workspaceId}/tasks`, input)
        .then((res) => unwrap(res.data)),
    );
  },

  async update(taskId: string, input: UpdateTaskInput): Promise<Task> {
    return withApiError(
      http
        .patch<ApiEnvelope<Task>>(`/tasks/${taskId}`, input)
        .then((res) => unwrap(res.data)),
    );
  },

  async remove(taskId: string): Promise<void> {
    return withApiError(
      http
        .delete<ApiEnvelope<unknown>>(`/tasks/${taskId}`)
        .then(() => undefined),
    );
  },
};
