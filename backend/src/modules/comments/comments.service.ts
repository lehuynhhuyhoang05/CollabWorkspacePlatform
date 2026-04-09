import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { Block } from '../blocks/entities/block.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceRole } from '../workspaces/entities/workspace-member.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    @InjectRepository(Block)
    private readonly blocksRepository: Repository<Block>,
    private readonly workspacesService: WorkspacesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAllForBlock(blockId: string, userId: string): Promise<Comment[]> {
    const blockContext = await this.getBlockContextByBlockId(blockId);
    await this.workspacesService.assertMember(blockContext.workspaceId, userId);

    return this.commentsRepository.find({
      where: { blockId },
      relations: ['user', 'resolvedByUser', 'reopenedByUser'],
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    blockId: string,
    dto: CreateCommentDto,
    userId: string,
  ): Promise<Comment> {
    const blockContext = await this.getBlockContextByBlockId(blockId);
    await this.workspacesService.assertRole(blockContext.workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);

    const comment = this.commentsRepository.create({
      blockId,
      userId,
      content: dto.content,
    });

    const savedComment = await this.commentsRepository.save(comment);

    await this.notificationsService.createMentionNotifications({
      workspaceId: blockContext.workspaceId,
      actorUserId: userId,
      content: dto.content,
      pageId: blockContext.pageId,
      commentId: savedComment.id,
    });

    await this.notificationsService.recordWorkspaceActivity({
      workspaceId: blockContext.workspaceId,
      actorUserId: userId,
      type: 'comment_created',
      message: 'Đã tạo bình luận mới',
      entityType: 'comment',
      entityId: savedComment.id,
    });

    return savedComment;
  }

  async update(
    commentId: string,
    dto: UpdateCommentDto,
    userId: string,
  ): Promise<Comment> {
    const comment = await this.findOneRaw(commentId);
    const blockContext = await this.getBlockContextByBlockId(comment.blockId);

    await this.workspacesService.assertRole(blockContext.workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);

    // Only comment author can edit
    if (comment.userId !== userId) {
      throw new ForbiddenException('Chỉ tác giả mới có thể sửa comment');
    }

    comment.content = dto.content;
    const savedComment = await this.commentsRepository.save(comment);

    await this.notificationsService.createMentionNotifications({
      workspaceId: blockContext.workspaceId,
      actorUserId: userId,
      content: dto.content,
      pageId: blockContext.pageId,
      commentId: savedComment.id,
    });

    await this.notificationsService.recordWorkspaceActivity({
      workspaceId: blockContext.workspaceId,
      actorUserId: userId,
      type: 'comment_updated',
      message: 'Đã chỉnh sửa bình luận',
      entityType: 'comment',
      entityId: savedComment.id,
    });

    return savedComment;
  }

  async remove(commentId: string, userId: string): Promise<void> {
    const comment = await this.findOneRaw(commentId);
    const blockContext = await this.getBlockContextByBlockId(comment.blockId);

    await this.workspacesService.assertRole(blockContext.workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);

    // Only comment author can delete
    if (comment.userId !== userId) {
      throw new ForbiddenException('Chỉ tác giả mới có thể xoá comment');
    }

    await this.commentsRepository.delete(commentId);

    await this.notificationsService.recordWorkspaceActivity({
      workspaceId: blockContext.workspaceId,
      actorUserId: userId,
      type: 'comment_deleted',
      message: 'Đã xóa một bình luận',
      entityType: 'comment',
      entityId: commentId,
    });
  }

  async resolve(commentId: string, userId: string): Promise<Comment> {
    const comment = await this.findOneRaw(commentId);
    const blockContext = await this.getBlockContextByBlockId(comment.blockId);

    await this.workspacesService.assertRole(blockContext.workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);

    if (comment.isResolved) {
      return this.commentsRepository.findOneOrFail({
        where: { id: commentId },
        relations: ['user', 'resolvedByUser', 'reopenedByUser'],
      });
    }

    comment.isResolved = true;
    comment.resolvedAt = new Date();
    comment.resolvedByUserId = userId;
    comment.reopenedAt = null;
    comment.reopenedByUserId = null;

    await this.commentsRepository.save(comment);

    await this.notificationsService.recordWorkspaceActivity({
      workspaceId: blockContext.workspaceId,
      actorUserId: userId,
      type: 'comment_resolved',
      message: 'Đã đánh dấu bình luận là đã xử lý',
      entityType: 'comment',
      entityId: commentId,
    });

    return this.commentsRepository.findOneOrFail({
      where: { id: commentId },
      relations: ['user', 'resolvedByUser', 'reopenedByUser'],
    });
  }

  async reopen(commentId: string, userId: string): Promise<Comment> {
    const comment = await this.findOneRaw(commentId);
    const blockContext = await this.getBlockContextByBlockId(comment.blockId);

    await this.workspacesService.assertRole(blockContext.workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);

    if (!comment.isResolved) {
      return this.commentsRepository.findOneOrFail({
        where: { id: commentId },
        relations: ['user', 'resolvedByUser', 'reopenedByUser'],
      });
    }

    comment.isResolved = false;
    comment.reopenedAt = new Date();
    comment.reopenedByUserId = userId;

    await this.commentsRepository.save(comment);

    await this.notificationsService.recordWorkspaceActivity({
      workspaceId: blockContext.workspaceId,
      actorUserId: userId,
      type: 'comment_reopened',
      message: 'Đã mở lại bình luận',
      entityType: 'comment',
      entityId: commentId,
    });

    return this.commentsRepository.findOneOrFail({
      where: { id: commentId },
      relations: ['user', 'resolvedByUser', 'reopenedByUser'],
    });
  }

  private async findOneRaw(id: string): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({ where: { id } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  private async getBlockContextByBlockId(
    blockId: string,
  ): Promise<{ workspaceId: string; pageId: string }> {
    const block = await this.blocksRepository
      .createQueryBuilder('b')
      .innerJoin('b.page', 'p')
      .select('p.workspace_id', 'workspaceId')
      .addSelect('b.page_id', 'pageId')
      .where('b.id = :blockId', { blockId })
      .getRawOne<{ workspaceId: string; pageId: string }>();

    if (!block?.workspaceId || !block?.pageId) {
      throw new NotFoundException('Block not found');
    }

    return {
      workspaceId: block.workspaceId,
      pageId: block.pageId,
    };
  }
}
