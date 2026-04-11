import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType } from './entities/notification.entity';
import { WorkspaceActivity } from './entities/workspace-activity.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { Task, TaskStatus } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';

describe('NotificationsService automatic scheduler flow', () => {
  let service: NotificationsService;

  const storedNotifications: Notification[] = [];

  const notificationsRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const activitiesRepository = {
    save: jest.fn(),
    find: jest.fn(),
  };

  const membersRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const tasksQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const tasksRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(tasksQueryBuilder),
  };

  const usersRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const workspacesService = {
    assertMember: jest.fn(),
  };

  beforeEach(() => {
    storedNotifications.length = 0;
    jest.clearAllMocks();

    notificationsRepository.create.mockImplementation(
      (payload: Partial<Notification>) => payload as Notification,
    );

    notificationsRepository.save.mockImplementation(
      async (payload: Notification | Notification[]) => {
        const entities = Array.isArray(payload) ? payload : [payload];
        const saved = entities.map((entity, index) => {
          const savedEntity = {
            ...entity,
            id: entity.id || `notif-${storedNotifications.length + index + 1}`,
            createdAt: entity.createdAt || new Date(),
            isRead: entity.isRead ?? false,
            readAt: entity.readAt || null,
          } as Notification;
          return savedEntity;
        });

        storedNotifications.push(...saved);
        return Array.isArray(payload) ? saved : saved[0];
      },
    );

    notificationsRepository.findOne.mockImplementation(
      async (query: {
        where: Partial<
          Pick<
            Notification,
            'userId' | 'type' | 'entityType' | 'entityId' | 'isRead'
          >
        >;
      }) => {
        const { where } = query;
        return (
          storedNotifications.find(
            (item) =>
              item.userId === where.userId &&
              item.type === where.type &&
              item.entityType === where.entityType &&
              item.entityId === where.entityId &&
              item.isRead === where.isRead,
          ) || null
        );
      },
    );

    const overdueTask = {
      id: 'task-1',
      workspaceId: 'workspace-1',
      title: 'Overdue task',
      status: TaskStatus.TODO,
      dueDate: new Date(Date.now() - 60 * 60 * 1000),
      assigneeId: 'user-1',
      createdBy: 'user-2',
    } as Task;

    tasksQueryBuilder.getMany.mockResolvedValue([overdueTask]);

    service = new NotificationsService(
      notificationsRepository as unknown as Repository<Notification>,
      activitiesRepository as unknown as Repository<WorkspaceActivity>,
      membersRepository as unknown as Repository<WorkspaceMember>,
      tasksRepository as unknown as Repository<Task>,
      usersRepository as unknown as Repository<User>,
      workspacesService as unknown as WorkspacesService,
    );
  });

  it('does not create duplicate overdue notifications across repeated scans', async () => {
    const firstRun = await service.runAutomaticTaskReminders();
    const secondRun = await service.runAutomaticTaskReminders();

    expect(firstRun.scanned).toBe(1);
    expect(firstRun.created).toBe(1);

    expect(secondRun.scanned).toBe(1);
    expect(secondRun.created).toBe(0);

    expect(storedNotifications).toHaveLength(1);
    expect(storedNotifications[0].type).toBe(NotificationType.TASK_OVERDUE);
    expect(storedNotifications[0].entityType).toBe('task');
    expect(storedNotifications[0].entityId).toBe('task-1');
  });
});
