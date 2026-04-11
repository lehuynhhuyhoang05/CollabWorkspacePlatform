import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskPriority, TaskStatus } from './entities/task.entity';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { WorkspacesService } from '../workspaces/workspaces.service';
import {
  WorkspaceMember,
  WorkspaceRole,
} from '../workspaces/entities/workspace-member.entity';
import { Page } from '../pages/entities/page.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepository: Repository<WorkspaceMember>,
    @InjectRepository(Page)
    private readonly pagesRepository: Repository<Page>,
    private readonly workspacesService: WorkspacesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAllForWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<Task[]> {
    await this.workspacesService.assertMember(workspaceId, userId);

    const tasks = await this.tasksRepository.find({
      where: { workspaceId },
      relations: ['assignee', 'creator', 'parentTask', 'relatedPage'],
      order: {
        dueDate: 'ASC',
        createdAt: 'DESC',
      },
    });

    return this.attachRollup(tasks);
  }

  async findMyTasks(userId: string): Promise<Task[]> {
    const tasks = await this.tasksRepository
      .createQueryBuilder('t')
      .innerJoin(
        'workspace_members',
        'wm',
        'wm.workspace_id = t.workspace_id AND wm.user_id = :userId',
        { userId },
      )
      .leftJoinAndSelect('t.assignee', 'assignee')
      .leftJoinAndSelect('t.creator', 'creator')
      .leftJoinAndSelect('t.workspace', 'workspace')
      .leftJoinAndSelect('t.parentTask', 'parentTask')
      .leftJoinAndSelect('t.relatedPage', 'relatedPage')
      .where('t.assignee_id = :userId', { userId })
      .orderBy('t.dueDate', 'ASC', 'NULLS LAST')
      .addOrderBy('t.createdAt', 'DESC')
      .getMany();

    return this.attachRollup(tasks);
  }

  async create(
    workspaceId: string,
    dto: CreateTaskDto,
    userId: string,
  ): Promise<Task> {
    await this.workspacesService.assertRole(workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);

    const assigneeId = this.normalizeAssigneeId(dto.assigneeId);
    const parentTaskId = this.normalizeRelationId(dto.parentTaskId);
    const relatedPageId = this.normalizeRelationId(dto.relatedPageId);

    await this.assertAssigneeMember(workspaceId, assigneeId);
    await this.assertParentTask(workspaceId, parentTaskId);
    await this.assertRelatedPage(workspaceId, relatedPageId);

    const task = this.tasksRepository.create({
      workspaceId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      status: dto.status ?? TaskStatus.TODO,
      priority: dto.priority ?? TaskPriority.MEDIUM,
      dueDate: this.parseDueDate(dto.dueDate),
      assigneeId,
      parentTaskId,
      relatedPageId,
      createdBy: userId,
    });

    const saved = await this.tasksRepository.save(task);
    const hydratedTask = await this.findOneWithRelations(saved.id);

    await this.notificationsService.recordWorkspaceActivity({
      workspaceId,
      actorUserId: userId,
      type: 'task_created',
      message: `Đã tạo task: ${hydratedTask.title}`,
      entityType: 'task',
      entityId: hydratedTask.id,
    });

    await this.notificationsService.createTaskAssignedNotification(
      hydratedTask,
      userId,
    );
    await this.notificationsService.createDeadlineReminderForTask(
      hydratedTask,
      userId,
    );
    await this.notificationsService.createTaskOverdueNotification(
      hydratedTask,
      userId,
    );

    return hydratedTask;
  }

  async update(
    taskId: string,
    dto: UpdateTaskDto,
    userId: string,
  ): Promise<Task> {
    const task = await this.findOneRaw(taskId);
    const previousAssigneeId = task.assigneeId;
    const previousDueDate = this.toIsoDate(task.dueDate);
    const previousStatus = task.status;

    const role = await this.workspacesService.getMemberRole(
      task.workspaceId,
      userId,
    );
    if (!role) {
      throw new ForbiddenException(
        'Bạn không phải thành viên của workspace này',
      );
    }

    const isOwnerOrEditor =
      role === WorkspaceRole.OWNER || role === WorkspaceRole.EDITOR;
    const isTaskAssignee = task.assigneeId === userId;

    if (!isOwnerOrEditor && !isTaskAssignee) {
      throw new ForbiddenException('Bạn không có quyền cập nhật task này');
    }

    const isAssigneeLimitedMode = !isOwnerOrEditor && isTaskAssignee;
    const triesRestrictedFields =
      dto.title !== undefined ||
      dto.description !== undefined ||
      dto.assigneeId !== undefined ||
      dto.parentTaskId !== undefined ||
      dto.relatedPageId !== undefined;

    if (isAssigneeLimitedMode && triesRestrictedFields) {
      throw new ForbiddenException(
        'Bạn chỉ có thể cập nhật trạng thái, độ ưu tiên hoặc hạn chót của task được giao',
      );
    }

    if (dto.title !== undefined) {
      task.title = dto.title.trim();
    }

    if (dto.description !== undefined) {
      task.description = dto.description?.trim() || null;
    }

    if (dto.status !== undefined) {
      task.status = dto.status;
    }

    if (dto.priority !== undefined) {
      task.priority = dto.priority;
    }

    if (dto.dueDate !== undefined) {
      task.dueDate = this.parseDueDate(dto.dueDate);
    }

    if (dto.assigneeId !== undefined) {
      const assigneeId = this.normalizeAssigneeId(dto.assigneeId);
      await this.assertAssigneeMember(task.workspaceId, assigneeId);
      task.assigneeId = assigneeId;
    }

    if (dto.parentTaskId !== undefined) {
      const parentTaskId = this.normalizeRelationId(dto.parentTaskId);
      await this.assertParentTask(task.workspaceId, parentTaskId, task.id);
      task.parentTaskId = parentTaskId;
    }

    if (dto.relatedPageId !== undefined) {
      const relatedPageId = this.normalizeRelationId(dto.relatedPageId);
      await this.assertRelatedPage(task.workspaceId, relatedPageId);
      task.relatedPageId = relatedPageId;
    }

    await this.tasksRepository.save(task);
    const hydratedTask = await this.findOneWithRelations(task.id);

    await this.notificationsService.recordWorkspaceActivity({
      workspaceId: hydratedTask.workspaceId,
      actorUserId: userId,
      type: 'task_updated',
      message: `Đã cập nhật task: ${hydratedTask.title}`,
      entityType: 'task',
      entityId: hydratedTask.id,
    });

    const assigneeChanged = previousAssigneeId !== hydratedTask.assigneeId;
    if (assigneeChanged) {
      await this.notificationsService.createTaskAssignedNotification(
        hydratedTask,
        userId,
      );
    }

    const dueDateNow = this.toIsoDate(hydratedTask.dueDate);
    const dueOrStatusChanged =
      previousDueDate !== dueDateNow || previousStatus !== hydratedTask.status;

    if (dueOrStatusChanged) {
      await this.notificationsService.createDeadlineReminderForTask(
        hydratedTask,
        userId,
      );
      await this.notificationsService.createTaskOverdueNotification(
        hydratedTask,
        userId,
      );
    }

    if (previousStatus !== hydratedTask.status) {
      await this.notificationsService.createTaskStatusChangeNotifications(
        hydratedTask,
        previousStatus,
        userId,
      );
    }

    return hydratedTask;
  }

  async remove(taskId: string, userId: string): Promise<void> {
    const task = await this.findOneRaw(taskId);

    await this.workspacesService.assertRole(task.workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);

    await this.notificationsService.recordWorkspaceActivity({
      workspaceId: task.workspaceId,
      actorUserId: userId,
      type: 'task_deleted',
      message: `Đã xóa task: ${task.title}`,
      entityType: 'task',
      entityId: task.id,
    });

    await this.tasksRepository.delete(taskId);
    this.logger.log(`Task deleted: ${taskId} by ${userId}`);
  }

  private async findOneRaw(taskId: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private async findOneWithRelations(taskId: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      relations: [
        'assignee',
        'creator',
        'workspace',
        'parentTask',
        'relatedPage',
      ],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  private normalizeAssigneeId(assigneeId?: string | null): string | null {
    if (assigneeId === undefined || assigneeId === null) {
      return null;
    }

    const trimmed = assigneeId.trim();
    return trimmed || null;
  }

  private normalizeRelationId(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  private parseDueDate(dueDate?: string | null): Date | null {
    if (!dueDate) {
      return null;
    }

    const parsed = new Date(dueDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Due date không hợp lệ');
    }

    return parsed;
  }

  private toIsoDate(value?: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private async assertParentTask(
    workspaceId: string,
    parentTaskId: string | null,
    currentTaskId?: string,
  ): Promise<void> {
    if (!parentTaskId) {
      return;
    }

    if (currentTaskId && parentTaskId === currentTaskId) {
      throw new BadRequestException('Task không thể là parent của chính nó');
    }

    const parentTask = await this.tasksRepository.findOne({
      where: { id: parentTaskId, workspaceId },
      select: ['id', 'parentTaskId'],
    });

    if (!parentTask) {
      throw new NotFoundException('Parent task không thuộc workspace này');
    }

    if (!currentTaskId) {
      return;
    }

    let cursorParentId = parentTask.parentTaskId;

    while (cursorParentId) {
      if (cursorParentId === currentTaskId) {
        throw new BadRequestException('Quan hệ parent task bị vòng lặp');
      }

      const parent = await this.tasksRepository.findOne({
        where: { id: cursorParentId, workspaceId },
        select: ['id', 'parentTaskId'],
      });

      cursorParentId = parent?.parentTaskId ?? null;
    }
  }

  private async assertRelatedPage(
    workspaceId: string,
    relatedPageId: string | null,
  ): Promise<void> {
    if (!relatedPageId) {
      return;
    }

    const relatedPage = await this.pagesRepository.findOne({
      where: {
        id: relatedPageId,
        workspaceId,
        isDeleted: false,
      },
      select: ['id'],
    });

    if (!relatedPage) {
      throw new NotFoundException('Related page không thuộc workspace này');
    }
  }

  private async assertAssigneeMember(
    workspaceId: string,
    assigneeId: string | null,
  ): Promise<void> {
    if (!assigneeId) {
      return;
    }

    const member = await this.membersRepository.findOne({
      where: { workspaceId, userId: assigneeId },
      select: ['id'],
    });

    if (!member) {
      throw new NotFoundException('Assignee phải là thành viên của workspace');
    }
  }

  private attachRollup(tasks: Task[]): Task[] {
    const summaryByParentId = new Map<
      string,
      { subtaskTotal: number; subtaskDone: number }
    >();

    tasks.forEach((task) => {
      if (!task.parentTaskId) {
        return;
      }

      const summary = summaryByParentId.get(task.parentTaskId) || {
        subtaskTotal: 0,
        subtaskDone: 0,
      };

      summary.subtaskTotal += 1;
      if (task.status === TaskStatus.DONE) {
        summary.subtaskDone += 1;
      }

      summaryByParentId.set(task.parentTaskId, summary);
    });

    return tasks.map((task) => {
      const summary = summaryByParentId.get(task.id) || {
        subtaskTotal: 0,
        subtaskDone: 0,
      };

      const progress =
        summary.subtaskTotal === 0
          ? 0
          : Math.round((summary.subtaskDone / summary.subtaskTotal) * 100);

      return Object.assign(task, {
        rollup: {
          ...summary,
          progress,
        },
      });
    });
  }
}
