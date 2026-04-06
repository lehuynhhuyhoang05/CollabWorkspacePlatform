import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspaceRole } from '../workspaces/entities/workspace-member.entity';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

import { CommentsService } from './comments.service';

describe('CommentsService RBAC', () => {
  let service: CommentsService;
  let commentsRepository: any;
  let blocksRepository: any;
  let workspacesService: any;

  beforeEach(() => {
    const blockQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ workspaceId: 'w1' }),
    };

    commentsRepository = {
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
      findOne: jest.fn(),
      delete: jest.fn(),
    };

    blocksRepository = {
      createQueryBuilder: jest.fn(() => blockQb),
    };

    workspacesService = {
      assertMember: jest.fn(),
      assertRole: jest.fn(),
    };

    service = new CommentsService(
      commentsRepository,
      blocksRepository,
      workspacesService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('findAllForBlock should enforce workspace membership', async () => {
    await service.findAllForBlock('b1', 'u1');

    expect(workspacesService.assertMember).toHaveBeenCalledWith('w1', 'u1');
  });

  it('create should require owner/editor role', async () => {
    await service.create('b1', { content: 'cmt' }, 'u1');

    expect(workspacesService.assertRole).toHaveBeenCalledWith('w1', 'u1', [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);
  });

  it('update should reject when caller is not comment author', async () => {
    commentsRepository.findOne.mockResolvedValueOnce({
      id: 'c1',
      blockId: 'b1',
      userId: 'author',
      content: 'old',
    });

    await expect(
      service.update('c1', { content: 'new' }, 'other-user'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('remove should throw if comment does not exist', async () => {
    commentsRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.remove('missing', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
