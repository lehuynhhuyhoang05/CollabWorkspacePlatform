import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { App } from 'supertest/types';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

jest.mock('../src/common/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest();
      req.user = { id: 'viewer-user', email: 'viewer@example.com' };
      return true;
    }
  },
}));

import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { WorkspacesService } from '../src/modules/workspaces/workspaces.service';

import { PagesController } from '../src/modules/pages/pages.controller';
import { PagesService } from '../src/modules/pages/pages.service';
import { Page } from '../src/modules/pages/entities/page.entity';
import { PageVersion } from '../src/modules/pages/entities/page-version.entity';

import { CommentsController } from '../src/modules/comments/comments.controller';
import { CommentsService } from '../src/modules/comments/comments.service';
import { Comment } from '../src/modules/comments/entities/comment.entity';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

import { Block } from '../src/modules/blocks/entities/block.entity';

describe('RBAC Path (integration/e2e)', () => {
  let app: INestApplication<App>;
  let workspacesServiceMock: any;

  beforeEach(async () => {
    workspacesServiceMock = {
      assertRole: jest
        .fn()
        .mockRejectedValue(
          new ForbiddenException('Bạn không có quyền thực hiện thao tác này'),
        ),
      assertMember: jest.fn().mockResolvedValue(undefined),
    };

    const pagesRepositoryMock = {
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
      })),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      findOne: jest.fn().mockResolvedValue({
        id: 'p1',
        workspaceId: 'w1',
        isDeleted: false,
        blocks: [],
      }),
      find: jest.fn().mockResolvedValue([]),
    };

    const versionsRepositoryMock = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x),
      count: jest.fn().mockResolvedValue(0),
      delete: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    const blocksRepositoryMock = {
      findOne: jest.fn().mockResolvedValue({ id: 'b1', pageId: 'p1' }),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          workspaceId: 'w1',
          pageId: 'p1',
        }),
      })),
    };

    const notificationsServiceMock = {
      createMentionNotifications: jest.fn(),
      recordWorkspaceActivity: jest.fn(),
    };

    const commentsRepositoryMock = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      findOne: jest.fn().mockResolvedValue({
        id: 'c1',
        blockId: 'b1',
        userId: 'viewer-user',
      }),
      delete: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PagesController, CommentsController],
      providers: [
        PagesService,
        CommentsService,
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
        { provide: WorkspacesService, useValue: workspacesServiceMock },
        { provide: getRepositoryToken(Page), useValue: pagesRepositoryMock },
        {
          provide: getRepositoryToken(PageVersion),
          useValue: versionsRepositoryMock,
        },
        { provide: getRepositoryToken(Block), useValue: blocksRepositoryMock },
        {
          provide: getRepositoryToken(Comment),
          useValue: commentsRepositoryMock,
        },
        {
          provide: NotificationsService,
          useValue: notificationsServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /workspaces/:wid/pages should return 403 for viewer on mutate', async () => {
    await request(app.getHttpServer())
      .post('/workspaces/w1/pages')
      .send({ title: 'New Page' })
      .expect(403);
  });

  it('PATCH /pages/:id should return 403 for viewer on mutate', async () => {
    await request(app.getHttpServer())
      .patch('/pages/p1')
      .send({ title: 'Update Title' })
      .expect(403);
  });

  it('POST /blocks/:bid/comments should return 403 for viewer on mutate', async () => {
    await request(app.getHttpServer())
      .post('/blocks/b1/comments')
      .send({ content: 'comment' })
      .expect(403);
  });
});
