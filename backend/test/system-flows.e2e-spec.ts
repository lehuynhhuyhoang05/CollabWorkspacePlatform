import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  status: 'pending' | 'accepted' | 'refused' | 'canceled';
}

interface NotificationItem {
  type: string;
  entityType: string | null;
  entityId: string | null;
  message: string;
}

function unwrap<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    return body.data;
  }

  return body;
}

describe('System flows (e2e)', () => {
  let app: INestApplication;

  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ownerCredentials = {
    email: `owner.${uniqueSuffix}@example.com`,
    name: `Owner ${uniqueSuffix}`,
    password: 'OwnerPass123',
  };
  const memberCredentials = {
    email: `member.${uniqueSuffix}@example.com`,
    name: `Member ${uniqueSuffix}`,
    password: 'MemberPass123',
  };

  let ownerAccessToken = '';
  let memberAccessToken = '';
  let ownerUserId = '';
  let memberUserId = '';
  let workspaceId = '';
  let taskId = '';

  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api/v1', {
      exclude: ['health'],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
      new TransformInterceptor(),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('covers invite, chat, task status and forgot/reset password flows', async () => {
    const registerOwnerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(ownerCredentials)
      .expect(201);
    ownerAccessToken = unwrap<TokenPair>(
      registerOwnerResponse.body,
    ).accessToken;

    const registerMemberResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(memberCredentials)
      .expect(201);
    memberAccessToken = unwrap<TokenPair>(
      registerMemberResponse.body,
    ).accessToken;

    const ownerMeResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(authHeader(ownerAccessToken))
      .expect(200);
    ownerUserId = unwrap<{ id: string }>(ownerMeResponse.body).id;

    const memberMeResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(authHeader(memberAccessToken))
      .expect(200);
    memberUserId = unwrap<{ id: string }>(memberMeResponse.body).id;

    const createWorkspaceResponse = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set(authHeader(ownerAccessToken))
      .send({
        name: `Workspace ${uniqueSuffix}`,
        icon: 'E2E',
      })
      .expect(201);
    workspaceId = unwrap<{ id: string }>(createWorkspaceResponse.body).id;

    const inviteResponse = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/invite`)
      .set(authHeader(ownerAccessToken))
      .send({
        email: memberCredentials.email,
        role: 'editor',
      })
      .expect(201);

    const invitation = unwrap<WorkspaceInvitation>(inviteResponse.body);
    expect(invitation.status).toBe('pending');

    const incomingInvitationsResponse = await request(app.getHttpServer())
      .get('/api/v1/workspaces/invitations/incoming')
      .set(authHeader(memberAccessToken))
      .expect(200);

    const incomingInvitations = unwrap<WorkspaceInvitation[]>(
      incomingInvitationsResponse.body,
    );
    const incoming = incomingInvitations.find(
      (item) => item.id === invitation.id,
    );
    expect(incoming).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/api/v1/workspaces/invitations/${invitation.id}/respond`)
      .set(authHeader(memberAccessToken))
      .send({ action: 'accept' })
      .expect(200);

    const membersResponse = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}/members`)
      .set(authHeader(ownerAccessToken))
      .expect(200);

    const members = unwrap<Array<{ userId: string; role: string }>>(
      membersResponse.body,
    );
    expect(
      members.some(
        (member) => member.userId === memberUserId && member.role === 'editor',
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/notifications/messages')
      .set(authHeader(ownerAccessToken))
      .send({
        recipientId: memberUserId,
        workspaceId,
        content: `Message from owner ${uniqueSuffix}`,
      })
      .expect(201);

    const threadsResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications/messages/threads')
      .set(authHeader(memberAccessToken))
      .expect(200);

    const threads = unwrap<
      Array<{ counterpartId: string; unreadCount: number; lastMessage: string }>
    >(threadsResponse.body);
    const ownerThread = threads.find(
      (thread) => thread.counterpartId === ownerUserId,
    );
    expect(ownerThread).toBeDefined();
    expect(ownerThread?.unreadCount).toBeGreaterThanOrEqual(1);

    const threadDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/notifications/messages/thread/${ownerUserId}`)
      .set(authHeader(memberAccessToken))
      .expect(200);

    const threadMessages = unwrap<Array<{ message: string }>>(
      threadDetailResponse.body,
    );
    expect(
      threadMessages.some((item) =>
        item.message.includes(`Message from owner ${uniqueSuffix}`),
      ),
    ).toBe(true);

    const markThreadReadResponse = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/messages/thread/${ownerUserId}/read`)
      .set(authHeader(memberAccessToken))
      .expect(200);

    const markThreadRead = unwrap<{ updated: number }>(
      markThreadReadResponse.body,
    );
    expect(markThreadRead.updated).toBeGreaterThanOrEqual(1);

    const overdueDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const createTaskResponse = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/tasks`)
      .set(authHeader(ownerAccessToken))
      .send({
        title: `Task ${uniqueSuffix}`,
        status: 'todo',
        priority: 'high',
        dueDate: overdueDate,
        assigneeId: memberUserId,
      })
      .expect(201);

    taskId = unwrap<{ id: string }>(createTaskResponse.body).id;

    await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${taskId}`)
      .set(authHeader(ownerAccessToken))
      .send({ status: 'blocked' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${taskId}`)
      .set(authHeader(ownerAccessToken))
      .send({ status: 'done' })
      .expect(200);

    const inboxResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set(authHeader(memberAccessToken))
      .expect(200);

    const inbox = unwrap<NotificationItem[]>(inboxResponse.body).filter(
      (item) => item.entityType === 'task' && item.entityId === taskId,
    );

    const notificationTypes = inbox.map((item) => item.type);
    expect(notificationTypes).toEqual(
      expect.arrayContaining([
        'taskAssigned',
        'taskOverdue',
        'taskBlocked',
        'taskCompleted',
      ]),
    );

    const forgotPasswordResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: memberCredentials.email })
      .expect(200);

    const forgotPassword = unwrap<{
      message: string;
      resetUrlPreview?: string;
    }>(forgotPasswordResponse.body);

    expect(typeof forgotPassword.message).toBe('string');
    expect(forgotPassword.resetUrlPreview).toBeDefined();

    const resetUrl = new URL(forgotPassword.resetUrlPreview as string);
    const token = resetUrl.searchParams.get('token');
    expect(token).toBeTruthy();

    const newPassword = 'MemberResetPass123';
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token,
        newPassword,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: memberCredentials.email,
        password: memberCredentials.password,
      })
      .expect(401);

    const reloginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: memberCredentials.email,
        password: newPassword,
      })
      .expect(200);

    const reloginTokens = unwrap<TokenPair>(reloginResponse.body);
    expect(typeof reloginTokens.accessToken).toBe('string');
    expect(reloginTokens.accessToken.length).toBeGreaterThan(10);
  });
});
