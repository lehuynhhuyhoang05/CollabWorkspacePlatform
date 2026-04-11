import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { WorkspaceActivity } from './entities/workspace-activity.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { Task, TaskStatus } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';

interface CreateMentionNotificationsInput {
  workspaceId: string;
  actorUserId: string;
  content: string;
  pageId: string;
  commentId: string;
}

interface RecordWorkspaceActivityInput {
  workspaceId: string;
  actorUserId: string;
  type: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

interface CreateUniqueNotificationInput {
  workspaceId: string | null;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl: string | null;
  createdBy: string | null;
  entityType: string | null;
  entityId: string | null;
}

export interface MessageThreadSummary {
  counterpartId: string;
  counterpart: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null;
  lastMessage: string;
  lastMessageAt: Date;
  lastSenderId: string | null;
  unreadCount: number;
  workspaceId: string | null;
}

const DIRECT_MESSAGE_ENTITY_TYPE = 'direct_message';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(WorkspaceActivity)
    private readonly activitiesRepository: Repository<WorkspaceActivity>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepository: Repository<WorkspaceMember>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async listInbox(
    userId: string,
    unreadOnly: boolean,
  ): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: unreadOnly ? { userId, isRead: false } : { userId },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id: notificationId },
      relations: ['creator'],
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác notification này',
      );
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await this.notificationsRepository.save(notification);
    }

    return notification;
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const unread = await this.notificationsRepository.find({
      where: { userId, isRead: false },
      select: ['id'],
    });

    if (unread.length === 0) {
      return { updated: 0 };
    }

    const unreadIds = unread.map((item) => item.id);
    await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where('id IN (:...ids)', { ids: unreadIds })
      .execute();

    return { updated: unread.length };
  }

  async runAutomaticTaskReminders(): Promise<{
    scanned: number;
    created: number;
  }> {
    const now = Date.now();
    const horizon = new Date(now + 24 * 60 * 60 * 1000);
    const overdueFloor = new Date(now - 14 * 24 * 60 * 60 * 1000);

    const candidateTasks = await this.tasksRepository
      .createQueryBuilder('t')
      .where('t.assignee_id IS NOT NULL')
      .andWhere('t.due_date IS NOT NULL')
      .andWhere('t.status != :doneStatus', { doneStatus: TaskStatus.DONE })
      .andWhere('t.due_date <= :horizon', { horizon })
      .andWhere('t.due_date >= :overdueFloor', { overdueFloor })
      .getMany();

    let created = 0;
    for (const task of candidateTasks) {
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      if (!dueDate || Number.isNaN(dueDate.getTime())) {
        continue;
      }

      const isOverdue = dueDate.getTime() < now;
      const createdOne = isOverdue
        ? await this.createTaskOverdueNotification(task, task.createdBy)
        : await this.createDeadlineReminderForTask(task, task.createdBy);

      if (createdOne) {
        created += 1;
      }
    }

    this.logger.debug(
      `Automatic reminder scan finished: scanned=${candidateTasks.length}, created=${created}`,
    );

    return {
      scanned: candidateTasks.length,
      created,
    };
  }

  async listMessageContacts(
    userId: string,
  ): Promise<Array<Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>>> {
    const rows = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .addSelect('user.name', 'name')
      .addSelect('user.email', 'email')
      .addSelect('user.avatarUrl', 'avatarUrl')
      .innerJoin(
        'workspace_members',
        'contact_membership',
        'contact_membership.user_id = user.id',
      )
      .innerJoin(
        'workspace_members',
        'my_membership',
        'my_membership.workspace_id = contact_membership.workspace_id AND my_membership.user_id = :userId',
        { userId },
      )
      .where('user.id != :userId', { userId })
      .distinct(true)
      .orderBy('user.name', 'ASC')
      .getRawMany<{
        id: string;
        name: string;
        email: string;
        avatarUrl: string | null;
      }>();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      avatarUrl: row.avatarUrl,
    }));
  }

  async listMessageThreads(userId: string): Promise<MessageThreadSummary[]> {
    const messages = await this.notificationsRepository.find({
      where: {
        userId,
        type: NotificationType.DIRECT_MESSAGE,
        entityType: DIRECT_MESSAGE_ENTITY_TYPE,
      },
      order: { createdAt: 'DESC' },
      take: 600,
    });

    const threadMap = new Map<string, MessageThreadSummary>();

    for (const message of messages) {
      const counterpartId = message.entityId;
      if (!counterpartId) {
        continue;
      }

      const existing = threadMap.get(counterpartId);
      if (!existing) {
        threadMap.set(counterpartId, {
          counterpartId,
          counterpart: null,
          lastMessage: message.message,
          lastMessageAt: message.createdAt,
          lastSenderId: message.createdBy,
          unreadCount:
            !message.isRead && message.createdBy && message.createdBy !== userId
              ? 1
              : 0,
          workspaceId: message.workspaceId,
        });
        continue;
      }

      if (
        !message.isRead &&
        message.createdBy &&
        message.createdBy !== userId
      ) {
        existing.unreadCount += 1;
      }
    }

    const counterpartIds = Array.from(threadMap.keys());
    if (counterpartIds.length === 0) {
      return [];
    }

    const counterparts = await this.usersRepository.find({
      where: { id: In(counterpartIds) },
      select: ['id', 'name', 'email', 'avatarUrl'],
    });
    const counterpartMap = new Map(counterparts.map((user) => [user.id, user]));

    const summaries = Array.from(threadMap.values()).map((thread) => {
      const counterpart = counterpartMap.get(thread.counterpartId);
      return {
        ...thread,
        counterpart: counterpart
          ? {
              id: counterpart.id,
              name: counterpart.name,
              email: counterpart.email,
              avatarUrl: counterpart.avatarUrl,
            }
          : null,
      };
    });

    summaries.sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
    );

    return summaries;
  }

  async listMessageThread(
    userId: string,
    counterpartId: string,
    limit = 120,
  ): Promise<Notification[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 500);
    return this.notificationsRepository.find({
      where: {
        userId,
        type: NotificationType.DIRECT_MESSAGE,
        entityType: DIRECT_MESSAGE_ENTITY_TYPE,
        entityId: counterpartId,
      },
      relations: ['creator'],
      order: { createdAt: 'ASC' },
      take: boundedLimit,
    });
  }

  async markMessageThreadAsRead(
    userId: string,
    counterpartId: string,
  ): Promise<{ updated: number }> {
    const result = await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where('user_id = :userId', { userId })
      .andWhere('type = :type', { type: NotificationType.DIRECT_MESSAGE })
      .andWhere('entity_type = :entityType', {
        entityType: DIRECT_MESSAGE_ENTITY_TYPE,
      })
      .andWhere('entity_id = :counterpartId', { counterpartId })
      .andWhere('is_read = false')
      .andWhere('(created_by IS NULL OR created_by != :userId)', { userId })
      .execute();

    return {
      updated: result.affected || 0,
    };
  }

  async sendDirectMessage(
    senderId: string,
    recipientId: string,
    content: string,
    workspaceId?: string,
  ): Promise<Notification> {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new BadRequestException('Nội dung tin nhắn không được để trống');
    }

    if (recipientId === senderId) {
      throw new BadRequestException('Không thể gửi tin nhắn cho chính bạn');
    }

    const recipient = await this.usersRepository.findOne({
      where: { id: recipientId },
      select: ['id', 'name', 'email'],
    });
    if (!recipient) {
      throw new NotFoundException('Người nhận không tồn tại');
    }

    await this.assertMessagingPermission(senderId, recipientId, workspaceId);

    const senderCopy = this.notificationsRepository.create({
      workspaceId: workspaceId || null,
      userId: senderId,
      type: NotificationType.DIRECT_MESSAGE,
      title: `Đến ${recipient.name}`,
      message: trimmedContent,
      linkUrl: `/inbox?tab=messages&user=${recipientId}`,
      createdBy: senderId,
      entityType: DIRECT_MESSAGE_ENTITY_TYPE,
      entityId: recipientId,
      isRead: true,
      readAt: new Date(),
    });

    const recipientCopy = this.notificationsRepository.create({
      workspaceId: workspaceId || null,
      userId: recipientId,
      type: NotificationType.DIRECT_MESSAGE,
      title: 'Tin nhắn mới',
      message: trimmedContent,
      linkUrl: `/inbox?tab=messages&user=${senderId}`,
      createdBy: senderId,
      entityType: DIRECT_MESSAGE_ENTITY_TYPE,
      entityId: senderId,
      isRead: false,
      readAt: null,
    });

    await this.notificationsRepository.save([senderCopy, recipientCopy]);
    return senderCopy;
  }

  async listWorkspaceActivities(
    workspaceId: string,
    userId: string,
    limit = 30,
  ): Promise<WorkspaceActivity[]> {
    await this.workspacesService.assertMember(workspaceId, userId);

    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    return this.activitiesRepository.find({
      where: { workspaceId },
      relations: ['actor'],
      order: { createdAt: 'DESC' },
      take: boundedLimit,
    });
  }

  async createMentionNotifications(
    input: CreateMentionNotificationsInput,
  ): Promise<number> {
    const mentionEmails = this.extractMentionEmails(input.content);
    if (mentionEmails.length === 0) {
      return 0;
    }

    const members = await this.membersRepository.find({
      where: { workspaceId: input.workspaceId },
      relations: ['user'],
    });

    const mentionedUserIds = new Set<string>();
    for (const email of mentionEmails) {
      const matched = members.find(
        (member) => member.user?.email?.toLowerCase() === email,
      );

      if (!matched) continue;
      if (matched.userId === input.actorUserId) continue;
      mentionedUserIds.add(matched.userId);
    }

    if (mentionedUserIds.size === 0) {
      return 0;
    }

    const newNotifications = Array.from(mentionedUserIds).map(
      (mentionedUserId) =>
        this.notificationsRepository.create({
          workspaceId: input.workspaceId,
          userId: mentionedUserId,
          type: NotificationType.MENTION,
          title: 'Bạn được nhắc đến trong bình luận',
          message: 'Một bình luận mới có nhắc đến bạn.',
          linkUrl: `/pages/${input.pageId}`,
          createdBy: input.actorUserId,
          entityType: 'comment',
          entityId: input.commentId,
          isRead: false,
        }),
    );

    await this.notificationsRepository.save(newNotifications);
    return newNotifications.length;
  }

  async createTaskAssignedNotification(
    task: Task,
    actorUserId: string,
  ): Promise<boolean> {
    if (!task.assigneeId || task.assigneeId === actorUserId) {
      return false;
    }

    const existing = await this.notificationsRepository.findOne({
      where: {
        userId: task.assigneeId,
        type: NotificationType.TASK_ASSIGNED,
        entityType: 'task',
        entityId: task.id,
        isRead: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (existing) {
      return false;
    }

    return this.createUniqueUnreadNotification({
      workspaceId: task.workspaceId,
      userId: task.assigneeId,
      type: NotificationType.TASK_ASSIGNED,
      title: 'Bạn vừa được giao task mới',
      message: `Task: ${task.title}`,
      linkUrl: `/workspaces/${task.workspaceId}/tasks`,
      createdBy: actorUserId,
      entityType: 'task',
      entityId: task.id,
    });
  }

  async createDeadlineReminderForTask(
    task: Task,
    actorUserId: string,
  ): Promise<boolean> {
    if (!task.assigneeId || !task.dueDate || task.status === TaskStatus.DONE) {
      return false;
    }

    const dueDate = new Date(task.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      return false;
    }

    const now = Date.now();
    const dueTime = dueDate.getTime();
    const withinWindow = dueTime <= now + 72 * 60 * 60 * 1000 && dueTime >= now;

    if (!withinWindow) {
      return false;
    }

    const duplicate = await this.notificationsRepository.findOne({
      where: {
        userId: task.assigneeId,
        type: NotificationType.DEADLINE_REMINDER,
        entityType: 'task',
        entityId: task.id,
        isRead: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (duplicate) {
      return false;
    }

    return this.createUniqueUnreadNotification({
      workspaceId: task.workspaceId,
      userId: task.assigneeId,
      type: NotificationType.DEADLINE_REMINDER,
      title: 'Task sắp đến hạn',
      message: `Task "${task.title}" đến hạn lúc ${dueDate.toISOString()}`,
      linkUrl: `/workspaces/${task.workspaceId}/tasks`,
      createdBy: actorUserId,
      entityType: 'task',
      entityId: task.id,
    });
  }

  async createTaskOverdueNotification(
    task: Task,
    actorUserId: string,
  ): Promise<boolean> {
    if (!task.assigneeId || !task.dueDate || task.status === TaskStatus.DONE) {
      return false;
    }

    const dueDate = new Date(task.dueDate);
    if (Number.isNaN(dueDate.getTime()) || dueDate.getTime() >= Date.now()) {
      return false;
    }

    return this.createUniqueUnreadNotification({
      workspaceId: task.workspaceId,
      userId: task.assigneeId,
      type: NotificationType.TASK_OVERDUE,
      title: 'Task đã quá hạn',
      message: `Task "${task.title}" đã quá hạn từ ${dueDate.toISOString()}`,
      linkUrl: `/workspaces/${task.workspaceId}/tasks`,
      createdBy: actorUserId,
      entityType: 'task',
      entityId: task.id,
    });
  }

  async createTaskStatusChangeNotifications(
    task: Task,
    previousStatus: TaskStatus,
    actorUserId: string,
  ): Promise<number> {
    if (previousStatus === task.status) {
      return 0;
    }

    const recipients = new Set<string>();
    let type: NotificationType | null = null;
    let title = '';
    let message = '';

    if (task.status === TaskStatus.BLOCKED) {
      type = NotificationType.TASK_BLOCKED;
      title = 'Task đang bị chặn';
      message = `Task "${task.title}" vừa chuyển sang trạng thái blocked.`;
      if (task.createdBy) {
        recipients.add(task.createdBy);
      }
      if (task.assigneeId) {
        recipients.add(task.assigneeId);
      }
    }

    if (task.status === TaskStatus.DONE) {
      type = NotificationType.TASK_COMPLETED;
      title = 'Task đã hoàn thành';
      message = `Task "${task.title}" vừa được hoàn thành.`;
      if (task.createdBy) {
        recipients.add(task.createdBy);
      }
      if (task.assigneeId && task.assigneeId !== task.createdBy) {
        recipients.add(task.assigneeId);
      }
    }

    if (!type) {
      return 0;
    }

    recipients.delete(actorUserId);
    if (recipients.size === 0) {
      return 0;
    }

    let created = 0;
    for (const recipientId of recipients) {
      const createdOne = await this.createUniqueUnreadNotification({
        workspaceId: task.workspaceId,
        userId: recipientId,
        type,
        title,
        message,
        linkUrl: `/workspaces/${task.workspaceId}/tasks`,
        createdBy: actorUserId,
        entityType: 'task',
        entityId: task.id,
      });

      if (createdOne) {
        created += 1;
      }
    }

    return created;
  }

  async runDueSoonRemindersForUser(
    userId: string,
    workspaceId?: string,
  ): Promise<{ created: number }> {
    if (workspaceId) {
      await this.workspacesService.assertMember(workspaceId, userId);
    }

    const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const query = this.tasksRepository
      .createQueryBuilder('t')
      .innerJoin(
        'workspace_members',
        'wm',
        'wm.workspace_id = t.workspace_id AND wm.user_id = :userId',
        { userId },
      )
      .where('t.assignee_id = :userId', { userId })
      .andWhere('t.due_date IS NOT NULL')
      .andWhere('t.status != :doneStatus', { doneStatus: TaskStatus.DONE })
      .andWhere('t.due_date <= :horizon', { horizon });

    if (workspaceId) {
      query.andWhere('t.workspace_id = :workspaceId', { workspaceId });
    }

    const dueSoonTasks = await query.getMany();

    let created = 0;
    for (const task of dueSoonTasks) {
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      const isOverdue =
        dueDate &&
        !Number.isNaN(dueDate.getTime()) &&
        dueDate.getTime() < Date.now();

      const wasCreated = isOverdue
        ? await this.createTaskOverdueNotification(task, userId)
        : await this.createDeadlineReminderForTask(task, userId);

      if (wasCreated) {
        created += 1;
      }
    }

    return { created };
  }

  async recordWorkspaceActivity(
    input: RecordWorkspaceActivityInput,
  ): Promise<void> {
    await this.activitiesRepository.save(
      this.activitiesRepository.create({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        type: input.type,
        message: input.message,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
      }),
    );
  }

  private async createUniqueUnreadNotification(
    input: CreateUniqueNotificationInput,
  ): Promise<boolean> {
    const where: Record<string, unknown> = {
      userId: input.userId,
      type: input.type,
      isRead: false,
      entityType: input.entityType === null ? IsNull() : input.entityType,
      entityId: input.entityId === null ? IsNull() : input.entityId,
    };

    const duplicate = await this.notificationsRepository.findOne({
      where,
      order: { createdAt: 'DESC' },
    });

    if (duplicate) {
      return false;
    }

    await this.notificationsRepository.save(
      this.notificationsRepository.create({
        workspaceId: input.workspaceId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        linkUrl: input.linkUrl,
        createdBy: input.createdBy,
        entityType: input.entityType,
        entityId: input.entityId,
        isRead: false,
      }),
    );

    return true;
  }

  private async assertMessagingPermission(
    senderId: string,
    recipientId: string,
    workspaceId?: string,
  ): Promise<void> {
    if (workspaceId) {
      await this.workspacesService.assertMember(workspaceId, senderId);

      const recipientMember = await this.membersRepository.findOne({
        where: { workspaceId, userId: recipientId },
        select: ['id'],
      });

      if (!recipientMember) {
        throw new ForbiddenException(
          'Người nhận không thuộc workspace này nên không thể nhắn tin',
        );
      }

      return;
    }

    const sharedWorkspace = await this.membersRepository
      .createQueryBuilder('sender_member')
      .innerJoin(
        'workspace_members',
        'recipient_member',
        'recipient_member.workspace_id = sender_member.workspace_id AND recipient_member.user_id = :recipientId',
        { recipientId },
      )
      .where('sender_member.user_id = :senderId', { senderId })
      .getExists();

    if (!sharedWorkspace) {
      throw new ForbiddenException(
        'Hai người dùng cần chung ít nhất một workspace để nhắn tin',
      );
    }
  }

  private extractMentionEmails(content: string): string[] {
    const mentionMatches =
      content.match(/@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g) || [];

    const unique = new Set<string>();
    mentionMatches.forEach((match) => {
      unique.add(match.replace(/^@/, '').toLowerCase());
    });

    return Array.from(unique);
  }
}
