import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole } from '../workspaces/entities/workspace-member.entity';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

import { TasksService } from './tasks.service';

const TaskStatus = {
  TODO: 'todo',
  IN_PROGRESS: 'inProgress',
  DONE: 'done',
} as const;

const TaskPriority = {
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

describe('TasksService update RBAC', () => {
  let service: TasksService;
  let tasksRepository: any;
  let membersRepository: any;
  let pagesRepository: any;
  let workspacesService: any;
  let notificationsService: any;

  beforeEach(() => {
    tasksRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (data) => data),
      create: jest.fn((data) => data),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
    };

    membersRepository = {
      findOne: jest.fn(),
    };

    pagesRepository = {
      findOne: jest.fn(),
    };

    workspacesService = {
      assertMember: jest.fn(),
      assertRole: jest.fn(),
      getMemberRole: jest.fn(),
    };

    notificationsService = {
      recordWorkspaceActivity: jest.fn(),
      createTaskAssignedNotification: jest.fn(),
      createDeadlineReminderForTask: jest.fn(),
    };

    service = new TasksService(
      tasksRepository,
      membersRepository,
      pagesRepository,
      workspacesService,
      notificationsService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('assignee can update status, priority, and due date in limited mode', async () => {
    const initialTask = {
      id: 't1',
      workspaceId: 'w1',
      assigneeId: 'u-assignee',
      title: 'Task A',
      description: null,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: null,
    };

    tasksRepository.findOne
      .mockResolvedValueOnce(initialTask)
      .mockResolvedValueOnce({
        ...initialTask,
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        dueDate: new Date('2026-04-08T00:00:00.000Z'),
      });
    workspacesService.getMemberRole.mockResolvedValueOnce(WorkspaceRole.VIEWER);

    const result = await service.update(
      't1',
      {
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        dueDate: '2026-04-08T00:00:00.000Z',
      },
      'u-assignee',
    );

    expect(tasksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        dueDate: expect.any(Date),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 't1',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
      }),
    );
  });

  it('assignee limited mode should reject title update', async () => {
    tasksRepository.findOne.mockResolvedValueOnce({
      id: 't1',
      workspaceId: 'w1',
      assigneeId: 'u-assignee',
      title: 'Task A',
      description: null,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: null,
    });
    workspacesService.getMemberRole.mockResolvedValueOnce(WorkspaceRole.VIEWER);

    await expect(
      service.update('t1', { title: 'New Title' }, 'u-assignee'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('non-assignee viewer should not be able to update task', async () => {
    tasksRepository.findOne.mockResolvedValueOnce({
      id: 't1',
      workspaceId: 'w1',
      assigneeId: 'u-assignee',
      title: 'Task A',
      description: null,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: null,
    });
    workspacesService.getMemberRole.mockResolvedValueOnce(WorkspaceRole.VIEWER);

    await expect(
      service.update('t1', { status: TaskStatus.IN_PROGRESS }, 'u-other'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('owner can reassign task to workspace member', async () => {
    const initialTask = {
      id: 't1',
      workspaceId: 'w1',
      assigneeId: 'u-assignee',
      title: 'Task A',
      description: null,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: null,
    };

    tasksRepository.findOne
      .mockResolvedValueOnce(initialTask)
      .mockResolvedValueOnce({
        ...initialTask,
        assigneeId: 'u-new',
        title: 'Updated title',
      });
    workspacesService.getMemberRole.mockResolvedValueOnce(WorkspaceRole.OWNER);
    membersRepository.findOne.mockResolvedValueOnce({ id: 'member-1' });

    const result = await service.update(
      't1',
      { assigneeId: 'u-new', title: '  Updated title  ' },
      'u-owner',
    );

    expect(membersRepository.findOne).toHaveBeenCalledWith({
      where: { workspaceId: 'w1', userId: 'u-new' },
      select: ['id'],
    });
    expect(tasksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeId: 'u-new',
        title: 'Updated title',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 't1',
        assigneeId: 'u-new',
      }),
    );
  });
});
