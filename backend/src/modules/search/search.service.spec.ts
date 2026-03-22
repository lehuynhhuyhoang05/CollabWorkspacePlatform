jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let pagesRepository: any;
  let blocksRepository: any;

  beforeEach(() => {
    const makeQb = (rows: any[]) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    });

    pagesRepository = {
      createQueryBuilder: jest.fn(() => makeQb([])),
    };

    blocksRepository = {
      createQueryBuilder: jest.fn(() => makeQb([])),
    };

    service = new SearchService(pagesRepository, blocksRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns empty list for short query', async () => {
    const results = await service.search('w1', 'a');
    expect(results).toEqual([]);
    expect(pagesRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(blocksRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('dedupes content hits when same page already matched by title', async () => {
    const titleQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 'p1', title: 'Hello page', icon: null },
      ]),
    };

    const contentQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          pageId: 'p1',
          content: '{"type":"text","text":"hello from p1"}',
          page: { title: 'Hello page', icon: null },
        },
        {
          pageId: 'p2',
          content: '{"type":"text","text":"hello from p2"}',
          page: { title: 'Second page', icon: null },
        },
      ]),
    };

    pagesRepository.createQueryBuilder.mockReturnValueOnce(titleQb);
    blocksRepository.createQueryBuilder.mockReturnValueOnce(contentQb);

    const results = await service.search('w1', 'hello', 20);

    expect(results).toHaveLength(2);
    expect(results[0].pageId).toBe('p1');
    expect(results[0].matchType).toBe('title');
    expect(results[1].pageId).toBe('p2');
    expect(results[1].matchType).toBe('content');
  });

  it('caps limit to 50 and applies expected take values', async () => {
    const titleQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const contentQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    pagesRepository.createQueryBuilder.mockReturnValueOnce(titleQb);
    blocksRepository.createQueryBuilder.mockReturnValueOnce(contentQb);

    await service.search('w1', 'valid query', 999);

    expect(titleQb.take).toHaveBeenCalledWith(10);
    expect(contentQb.take).toHaveBeenCalledWith(50);
  });
});
