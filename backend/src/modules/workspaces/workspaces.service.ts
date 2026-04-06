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
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspacesRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepository: Repository<WorkspaceMember>,
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
      const { password: _, refreshTokenHash: __, ...safeOwner } = workspace.owner;
      workspace.owner = safeOwner as any;
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
  ): Promise<WorkspaceMember> {
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

    // Editors cannot invite as owner
    const inviterMember = await this.getMember(workspaceId, inviterId);
    if (inviterMember.role !== WorkspaceRole.OWNER && role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Chỉ owner mới có thể gán role owner');
    }

    const member = this.membersRepository.create({
      workspaceId,
      userId: user.id,
      role,
    });

    this.logger.log(
      `User ${user.id} invited to workspace ${workspaceId} as ${role} by ${inviterId}`,
    );
    return this.membersRepository.save(member);
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
      throw new ForbiddenException('Bạn không phải thành viên của workspace này');
    }
  }

  async assertRole(
    workspaceId: string,
    userId: string,
    allowedRoles: WorkspaceRole[],
  ): Promise<void> {
    const role = await this.getMemberRole(workspaceId, userId);
    if (!role) {
      throw new ForbiddenException('Bạn không phải thành viên của workspace này');
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
