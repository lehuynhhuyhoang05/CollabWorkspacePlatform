import { http } from "./http";
import { unwrap, withApiError } from "./utils";
import type {
  ApiEnvelope,
  Workspace,
  WorkspaceInvitation,
  WorkspaceInvitationAction,
  WorkspaceMember,
  WorkspaceRole,
} from "../types/api";

interface CreateWorkspaceInput {
  name: string;
  icon?: string;
}

interface UpdateWorkspaceInput {
  name?: string;
  icon?: string;
}

interface InviteMemberInput {
  email: string;
  role?: WorkspaceRole;
}

export const workspacesApi = {
  async list(): Promise<Workspace[]> {
    return withApiError(
      http
        .get<ApiEnvelope<Workspace[]>>("/workspaces")
        .then((res) => unwrap(res.data)),
    );
  },

  async getById(workspaceId: string): Promise<Workspace> {
    return withApiError(
      http
        .get<ApiEnvelope<Workspace>>(`/workspaces/${workspaceId}`)
        .then((res) => unwrap(res.data)),
    );
  },

  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    return withApiError(
      http
        .post<ApiEnvelope<Workspace>>("/workspaces", input)
        .then((res) => unwrap(res.data)),
    );
  },

  async update(workspaceId: string, input: UpdateWorkspaceInput): Promise<Workspace> {
    return withApiError(
      http
        .patch<ApiEnvelope<Workspace>>(`/workspaces/${workspaceId}`, input)
        .then((res) => unwrap(res.data)),
    );
  },

  async remove(workspaceId: string): Promise<void> {
    return withApiError(
      http
        .delete<ApiEnvelope<unknown>>(`/workspaces/${workspaceId}`)
        .then(() => undefined),
    );
  },

  async invite(workspaceId: string, input: InviteMemberInput): Promise<WorkspaceInvitation> {
    return withApiError(
      http
        .post<ApiEnvelope<WorkspaceInvitation>>(`/workspaces/${workspaceId}/invite`, input)
        .then((res) => unwrap(res.data)),
    );
  },

  async listIncomingInvitations(): Promise<WorkspaceInvitation[]> {
    return withApiError(
      http
        .get<ApiEnvelope<WorkspaceInvitation[]>>('/workspaces/invitations/incoming')
        .then((res) => unwrap(res.data)),
    );
  },

  async listWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    return withApiError(
      http
        .get<ApiEnvelope<WorkspaceInvitation[]>>(`/workspaces/${workspaceId}/invitations`)
        .then((res) => unwrap(res.data)),
    );
  },

  async respondInvitation(
    invitationId: string,
    action: WorkspaceInvitationAction,
  ): Promise<WorkspaceInvitation> {
    return withApiError(
      http
        .patch<ApiEnvelope<WorkspaceInvitation>>(
          `/workspaces/invitations/${invitationId}/respond`,
          { action },
        )
        .then((res) => unwrap(res.data)),
    );
  },

  async listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return withApiError(
      http
        .get<ApiEnvelope<WorkspaceMember[]>>(`/workspaces/${workspaceId}/members`)
        .then((res) => unwrap(res.data)),
    );
  },

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    return withApiError(
      http
        .patch<ApiEnvelope<WorkspaceMember>>(`/workspaces/${workspaceId}/members/${userId}`, {
          role,
        })
        .then((res) => unwrap(res.data)),
    );
  },

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    return withApiError(
      http
        .delete<ApiEnvelope<unknown>>(`/workspaces/${workspaceId}/members/${userId}`)
        .then(() => undefined),
    );
  },
};
