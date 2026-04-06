import { NotFoundException } from '@nestjs/common';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

import { BlocksService } from './blocks.service';

describe('BlocksService', () => {
  let service: BlocksService;
  let blocksRepository: any;
  let pagesService: any;

  beforeEach(() => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ max: 1 }),
    };

    blocksRepository = {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    };

    pagesService = {
      findOne: jest.fn(),
      assertCanEditPage: jest.fn(),
      createVersion: jest.fn(),
    };

    service = new BlocksService(blocksRepository, pagesService);
  });

  afterEach(() => jest.clearAllMocks());

  it('create should require edit permission and create version', async () => {
    const block = await service.create(
      'p1',
      { type: 'paragraph', content: 'hello' },
      'u1',
    );

    expect(pagesService.assertCanEditPage).toHaveBeenCalledWith('p1', 'u1');
    expect(pagesService.createVersion).toHaveBeenCalledWith('p1', 'u1');
    expect(block.sortOrder).toBe(2);
  });

  it('update should throw when block not found', async () => {
    blocksRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      service.update('missing', { content: 'x' }, 'u1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('reorder should throw when some blockIds do not belong to page', async () => {
    blocksRepository.find.mockResolvedValueOnce([{ id: 'b1' }]);

    await expect(
      service.reorder('p1', { blockIds: ['b1', 'b2'] }, 'u1'),
    ).rejects.toThrow(NotFoundException);
  });
});
