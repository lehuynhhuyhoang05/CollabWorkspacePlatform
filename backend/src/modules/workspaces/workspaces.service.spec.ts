import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceRole } from './entities/workspace-member.entity';
import type { UsersService } from '../users/users.service';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let workspacesRepository: any;
  let membersRepository: any;
  let invitationsRepository: any;
  let notificationsRepository: any;
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail'>>;

  beforeEach(() => {
    workspacesRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    membersRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };

    invitationsRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    notificationsRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    usersService = {
      findByEmail: jest.fn(),
    };

    service = new WorkspacesService(
      workspacesRepository,
      membersRepository,
      invitationsRepository,
      notificationsRepository,
      usersService as unknown as UsersService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create should persist workspace and auto add owner membership', async () => {
    workspacesRepository.save.mockResolvedValueOnce({
      id: 'w1',
      name: 'Workspace 1',
      ownerId: 'u1',
    });
    membersRepository.save.mockResolvedValueOnce({});

    const result = await service.create({ name: 'Workspace 1' }, 'u1');

    expect(result.id).toBe('w1');
    expect(membersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'w1',
        userId: 'u1',
        role: WorkspaceRole.OWNER,
      }),
    );
  });

  it('assertRole should throw when user is not a member', async () => {
    membersRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      service.assertRole('w1', 'u1', [WorkspaceRole.OWNER]),
    ).rejects.toThrow(ForbiddenException);
  });

  it('inviteMember should reject duplicate member', async () => {
    jest.spyOn(service, 'assertRole').mockResolvedValueOnce();
    usersService.findByEmail.mockResolvedValueOnce({ id: 'u2' } as any);
    membersRepository.findOne.mockResolvedValueOnce({
      id: 'm1',
      workspaceId: 'w1',
      userId: 'u2',
    });

    await expect(
      service.inviteMember('w1', 'u2@example.com', WorkspaceRole.VIEWER, 'u1'),
    ).rejects.toThrow(ConflictException);
  });

  it('inviteMember should block editor from assigning owner role', async () => {
    jest.spyOn(service, 'assertRole').mockResolvedValueOnce();
    usersService.findByEmail.mockResolvedValueOnce({ id: 'u2' } as any);
    invitationsRepository.findOne.mockResolvedValueOnce(null);
    membersRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'm-editor',
        workspaceId: 'w1',
        userId: 'u-editor',
        role: WorkspaceRole.EDITOR,
      });

    await expect(
      service.inviteMember(
        'w1',
        'u2@example.com',
        WorkspaceRole.OWNER,
        'u-editor',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateMemberRole should prevent changing own role', async () => {
    jest.spyOn(service, 'assertRole').mockResolvedValueOnce();

    await expect(
      service.updateMemberRole('w1', 'u1', WorkspaceRole.VIEWER, 'u1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('remove should throw when workspace does not exist', async () => {
    jest.spyOn(service, 'assertRole').mockResolvedValueOnce();
    workspacesRepository.delete.mockResolvedValueOnce({ affected: 0 });

    await expect(service.remove('w-missing', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
