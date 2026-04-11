import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { WorkspaceRole } from '../entities/workspace-member.entity';

export enum WorkspaceInvitationAction {
  ACCEPT = 'accept',
  REFUSE = 'refuse',
}

export class InviteMemberDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsOptional()
  @IsEnum(WorkspaceRole, { message: 'Role phải là owner, editor hoặc viewer' })
  role?: WorkspaceRole = WorkspaceRole.EDITOR;
}

export class UpdateMemberRoleDto {
  @IsEnum(WorkspaceRole, { message: 'Role phải là owner, editor hoặc viewer' })
  role: WorkspaceRole;
}

export class RespondInvitationDto {
  @IsEnum(WorkspaceInvitationAction, {
    message: 'Action phải là accept hoặc refuse',
  })
  action: WorkspaceInvitationAction;
}
