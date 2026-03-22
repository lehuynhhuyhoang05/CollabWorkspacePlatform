import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspaceRole } from '../workspaces/entities/workspace-member.entity';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

import { PagesService } from './pages.service';

describe('PagesService', () => {
  let service: PagesService;
  let pagesRepository: any;
  let versionsRepository: any;
  let blocksRepository: any;
  let workspacesService: any;

  beforeEach(() => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ max: 2 }),
    };

    pagesRepository = {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    versionsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => data),
      count: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    };

    blocksRepository = {
      find: jest.fn(),
      delete: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(),
    };

    workspacesService = {
      assertRole: jest.fn(),
      assertMember: jest.fn(),
    };

    service = new PagesService(
      pagesRepository,
      versionsRepository,
      blocksRepository,
      workspacesService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('create should require owner/editor role and assign next sort order', async () => {
    const page = await service.create('w1', { title: 'Doc' }, 'u1');

    expect(workspacesService.assertRole).toHaveBeenCalledWith('w1', 'u1', [
      WorkspaceRole.OWNER,
      WorkspaceRole.EDITOR,
    ]);
    expect(page.sortOrder).toBe(3);
    expect(page.title).toBe('Doc');
  });

  it('update should deny when edit role check fails', async () => {
    pagesRepository.findOne.mockResolvedValueOnce({
      id: 'p1',
      workspaceId: 'w1',
      title: 'Old',
    });
    workspacesService.assertRole.mockRejectedValueOnce(
      new ForbiddenException('forbidden'),
    );

    await expect(service.update('p1', { title: 'New' }, 'u2')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('assertCanEditPage should throw not found when page does not exist', async () => {
    pagesRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.assertCanEditPage('missing', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
