import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { WorkspaceActivity } from './entities/workspace-activity.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { Task, TaskStatus } from '../tasks/entities/task.entity';

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

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(WorkspaceActivity)
    private readonly activitiesRepository: Repository<WorkspaceActivity>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepository: Repository<WorkspaceMember>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async listInbox(userId: string, unreadOnly: boolean): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: unreadOnly ? { userId, isRead: false } : { userId },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id: notificationId },
      relations: ['creator'],
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác notification này');
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

    const newNotifications = Array.from(mentionedUserIds).map((mentionedUserId) =>
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

    await this.notificationsRepository.save(
      this.notificationsRepository.create({
        workspaceId: task.workspaceId,
        userId: task.assigneeId,
        type: NotificationType.TASK_ASSIGNED,
        title: 'Bạn vừa được giao task mới',
        message: `Task: ${task.title}`,
        linkUrl: `/workspaces/${task.workspaceId}/tasks`,
        createdBy: actorUserId,
        entityType: 'task',
        entityId: task.id,
        isRead: false,
      }),
    );

    return true;
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
    const withinWindow =
      dueTime <= now + 72 * 60 * 60 * 1000 &&
      dueTime >= now - 24 * 60 * 60 * 1000;

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

    await this.notificationsRepository.save(
      this.notificationsRepository.create({
        workspaceId: task.workspaceId,
        userId: task.assigneeId,
        type: NotificationType.DEADLINE_REMINDER,
        title: 'Task sắp đến hạn',
        message: `Task "${task.title}" đến hạn lúc ${dueDate.toISOString()}`,
        linkUrl: `/workspaces/${task.workspaceId}/tasks`,
        createdBy: actorUserId,
        entityType: 'task',
        entityId: task.id,
        isRead: false,
      }),
    );

    return true;
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
      const wasCreated = await this.createDeadlineReminderForTask(task, userId);
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

  private extractMentionEmails(content: string): string[] {
    const mentionMatches = content.match(/@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g) || [];

    const unique = new Set<string>();
    mentionMatches.forEach((match) => {
      unique.add(match.replace(/^@/, '').toLowerCase());
    });

    return Array.from(unique);
  }
}
