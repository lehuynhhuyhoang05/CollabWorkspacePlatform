import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from './entities/workspace.entity';
import {
  WorkspaceMember,
  WorkspaceRole,
} from './entities/workspace-member.entity';
import {
  WorkspaceInvitation,
  WorkspaceInvitationStatus,
} from './entities/workspace-invitation.entity';
import {
  Notification,
  NotificationType,
} from '../notifications/entities/notification.entity';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { UsersService } from '../users/users.service';
import { WorkspaceInvitationAction } from './dto/member.dto';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspacesRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepository: Repository<WorkspaceMember>,
    @InjectRepository(WorkspaceInvitation)
    private readonly invitationsRepository: Repository<WorkspaceInvitation>,
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    private readonly usersService: UsersService,
  ) {}

  // ──── Workspace CRUD ────

  async create(dto: CreateWorkspaceDto, userId: string): Promise<Workspace> {
    const workspace = this.workspacesRepository.create({
      ...dto,
      ownerId: userId,
    });
    const saved = await this.workspacesRepository.save(workspace);

    // Auto-add owner as member with 'owner' role
    await this.membersRepository.save(
      this.membersRepository.create({
        workspaceId: saved.id,
        userId,
        role: WorkspaceRole.OWNER,
      }),
    );

    this.logger.log(`Workspace created: ${saved.id} by ${userId}`);
    return saved;
  }

  async findAllForUser(userId: string): Promise<Workspace[]> {
    return this.workspacesRepository
      .createQueryBuilder('w')
      .innerJoin('workspace_members', 'wm', 'wm.workspace_id = w.id')
      .where('wm.user_id = :userId', { userId })
      .orderBy('w.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: string, userId: string): Promise<Workspace> {
    await this.assertMember(id, userId);

    const workspace = await this.workspacesRepository.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Strip owner password
    if (workspace.owner) {
      const safeOwner = { ...workspace.owner } as Partial<
        typeof workspace.owner
      >;
      delete safeOwner.password;
      delete safeOwner.refreshTokenHash;
      delete safeOwner.passwordResetTokenHash;
      delete safeOwner.passwordResetExpiresAt;
      workspace.owner = safeOwner as typeof workspace.owner;
    }

    return workspace;
  }

  async update(
    id: string,
    dto: UpdateWorkspaceDto,
    userId: string,
  ): Promise<Workspace> {
    await this.assertRole(id, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);

    const workspace = await this.workspacesRepository.findOne({
      where: { id },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    Object.assign(workspace, dto);
    return this.workspacesRepository.save(workspace);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.assertRole(id, userId, [WorkspaceRole.OWNER]);

    const result = await this.workspacesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Workspace not found');
    }

    this.logger.log(`Workspace deleted: ${id} by ${userId}`);
  }

  // ──── Members management ────

  async inviteMember(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    inviterId: string,
  ): Promise<WorkspaceInvitation> {
    // Only owner/editor can invite
    await this.assertRole(workspaceId, inviterId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);

    // Find user by email
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User với email này chưa đăng ký');
    }

    // Check if already a member
    const existing = await this.membersRepository.findOne({
      where: { workspaceId, userId: user.id },
    });
    if (existing) {
      throw new ConflictException('User đã là thành viên của workspace này');
    }

    const existingPendingInvitation = await this.invitationsRepository.findOne({
      where: {
        workspaceId,
        inviteeId: user.id,
        status: WorkspaceInvitationStatus.PENDING,
      },
    });
    if (existingPendingInvitation) {
      throw new ConflictException(
        'Đã có lời mời đang chờ phản hồi cho user này',
      );
    }

    // Editors cannot invite as owner
    const inviterMember = await this.getMember(workspaceId, inviterId);
    if (
      inviterMember.role !== WorkspaceRole.OWNER &&
      role === WorkspaceRole.OWNER
    ) {
      throw new ForbiddenException('Chỉ owner mới có thể gán role owner');
    }

    const invitation = this.invitationsRepository.create({
      workspaceId,
      inviterId,
      inviteeId: user.id,
      role,
      status: WorkspaceInvitationStatus.PENDING,
      message: null,
      respondedAt: null,
    });

    const saved = await this.invitationsRepository.save(invitation);

    this.logger.log(
      `Workspace invitation ${saved.id}: user ${user.id} invited to workspace ${workspaceId} as ${role} by ${inviterId}`,
    );

    const hydratedInvitation = await this.invitationsRepository.findOne({
      where: { id: saved.id },
      relations: ['workspace', 'inviter', 'invitee'],
    });

    const invitationForNotification = hydratedInvitation || saved;

    await this.notificationsRepository.save(
      this.notificationsRepository.create({
        workspaceId,
        userId: user.id,
        type: NotificationType.WORKSPACE_INVITATION,
        title: 'Bạn có lời mời tham gia workspace',
        message: `${invitationForNotification.inviter?.name || 'Một thành viên'} mời bạn vào workspace ${invitationForNotification.workspace?.name || workspaceId} với quyền ${role}.`,
        linkUrl: '/workspaces',
        createdBy: inviterId,
        entityType: 'workspace_invitation',
        entityId: invitationForNotification.id,
        isRead: false,
      }),
    );

    return hydratedInvitation || saved;
  }

  async listIncomingInvitations(
    userId: string,
  ): Promise<WorkspaceInvitation[]> {
    return this.invitationsRepository.find({
      where: {
        inviteeId: userId,
        status: WorkspaceInvitationStatus.PENDING,
      },
      relations: ['workspace', 'inviter', 'invitee'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async listWorkspaceInvitations(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceInvitation[]> {
    await this.assertRole(workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);

    return this.invitationsRepository.find({
      where: { workspaceId },
      relations: ['workspace', 'inviter', 'invitee'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async respondInvitation(
    invitationId: string,
    userId: string,
    action: WorkspaceInvitationAction,
  ): Promise<WorkspaceInvitation> {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
      relations: ['workspace', 'inviter', 'invitee'],
    });

    if (!invitation) {
      throw new NotFoundException('Lời mời không tồn tại');
    }

    if (invitation.inviteeId !== userId) {
      throw new ForbiddenException('Bạn không có quyền phản hồi lời mời này');
    }

    if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
      throw new ConflictException('Lời mời này đã được phản hồi trước đó');
    }

    if (action === WorkspaceInvitationAction.ACCEPT) {
      const existingMember = await this.membersRepository.findOne({
        where: {
          workspaceId: invitation.workspaceId,
          userId,
        },
      });

      if (!existingMember) {
        const member = this.membersRepository.create({
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        });
        await this.membersRepository.save(member);
      }

      invitation.status = WorkspaceInvitationStatus.ACCEPTED;
    } else {
      invitation.status = WorkspaceInvitationStatus.REFUSED;
    }

    invitation.respondedAt = new Date();
    const saved = await this.invitationsRepository.save(invitation);

    await this.notificationsRepository.save(
      this.notificationsRepository.create({
        workspaceId: invitation.workspaceId,
        userId: invitation.inviterId,
        type: NotificationType.WORKSPACE_INVITATION_RESPONSE,
        title:
          action === WorkspaceInvitationAction.ACCEPT
            ? 'Lời mời đã được chấp nhận'
            : 'Lời mời đã bị từ chối',
        message:
          action === WorkspaceInvitationAction.ACCEPT
            ? `${invitation.invitee?.name || 'Thành viên'} đã tham gia workspace ${invitation.workspace?.name || invitation.workspaceId}.`
            : `${invitation.invitee?.name || 'Thành viên'} đã từ chối lời mời vào workspace ${invitation.workspace?.name || invitation.workspaceId}.`,
        linkUrl: `/workspaces/${invitation.workspaceId}`,
        createdBy: userId,
        entityType: 'workspace_invitation',
        entityId: invitation.id,
        isRead: false,
      }),
    );

    this.logger.log(
      `Workspace invitation ${invitationId} responded by ${userId}: ${action}`,
    );
    return saved;
  }

  async getMembers(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember[]> {
    await this.assertMember(workspaceId, userId);

    return this.membersRepository.find({
      where: { workspaceId },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
  }

  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    newRole: WorkspaceRole,
    currentUserId: string,
  ): Promise<WorkspaceMember> {
    // Only owner can change roles
    await this.assertRole(workspaceId, currentUserId, [WorkspaceRole.OWNER]);

    // Cannot change own role
    if (targetUserId === currentUserId) {
      throw new ForbiddenException('Không thể thay đổi role của chính mình');
    }

    const member = await this.getMember(workspaceId, targetUserId);
    member.role = newRole;
    return this.membersRepository.save(member);
  }

  async removeMember(
    workspaceId: string,
    targetUserId: string,
    currentUserId: string,
  ): Promise<void> {
    // Owner can kick anyone; editors/viewers can only leave (remove self)
    if (targetUserId !== currentUserId) {
      await this.assertRole(workspaceId, currentUserId, [WorkspaceRole.OWNER]);
    }

    const member = await this.getMember(workspaceId, targetUserId);

    // Cannot remove the owner
    if (member.role === WorkspaceRole.OWNER && targetUserId !== currentUserId) {
      throw new ForbiddenException('Không thể xoá owner khỏi workspace');
    }

    // If owner is leaving, must transfer ownership first
    if (member.role === WorkspaceRole.OWNER && targetUserId === currentUserId) {
      throw new ForbiddenException(
        'Owner phải chuyển quyền sở hữu trước khi rời workspace',
      );
    }

    await this.membersRepository.delete(member.id);
    this.logger.log(
      `Member ${targetUserId} removed from workspace ${workspaceId} by ${currentUserId}`,
    );
  }

  // ──── Authorization helpers (exported for guards) ────

  async getMemberRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole | null> {
    const member = await this.membersRepository.findOne({
      where: { workspaceId, userId },
    });
    return member?.role ?? null;
  }

  async assertMember(workspaceId: string, userId: string): Promise<void> {
    const role = await this.getMemberRole(workspaceId, userId);
    if (!role) {
      throw new ForbiddenException(
        'Bạn không phải thành viên của workspace này',
      );
    }
  }

  async assertRole(
    workspaceId: string,
    userId: string,
    allowedRoles: WorkspaceRole[],
  ): Promise<void> {
    const role = await this.getMemberRole(workspaceId, userId);
    if (!role) {
      throw new ForbiddenException(
        'Bạn không phải thành viên của workspace này',
      );
    }
    if (!allowedRoles.includes(role)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
  }

  private async getMember(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember> {
    const member = await this.membersRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }
}
