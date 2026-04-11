import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { Subscription } from 'rxjs';
import { BlocksService } from '../blocks/blocks.service';
import { CollaborationEventsService } from './collaboration-events.service';

interface ConnectedUser {
  userId: string;
  userName: string;
  color: string;
}

interface CollaborationSocketData {
  userId?: string;
  userName?: string;
  color?: string;
}

interface JwtSocketPayload {
  sub: string;
  name?: string;
}

const CURSOR_COLORS = [
  '#F87171',
  '#60A5FA',
  '#34D399',
  '#FBBF24',
  '#A78BFA',
  '#F472B6',
  '#FB923C',
  '#2DD4BF',
];

@WebSocketGateway({
  namespace: '/collaboration',
  cors: {
    origin: '*', // Will be restricted via ConfigService in production
    credentials: true,
  },
})
export class CollaborationGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);

  // Track connected users per room for presence
  private readonly roomUsers = new Map<string, Map<string, ConnectedUser>>();
  private blockEventsSubscription?: Subscription;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly blocksService: BlocksService,
    private readonly collaborationEventsService: CollaborationEventsService,
  ) {}

  onModuleInit() {
    this.blockEventsSubscription =
      this.collaborationEventsService.blockEvents$.subscribe((event) => {
        if (!this.server) {
          return;
        }

        this.server.to(`page:${event.pageId}`).emit(event.type, event.payload);
      });
  }

  onModuleDestroy() {
    this.blockEventsSubscription?.unsubscribe();
  }

  // ──── Connection lifecycle ────

  handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn('WebSocket connection rejected: no token');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtSocketPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (!payload.sub) {
        this.logger.warn('WebSocket connection rejected: token missing sub');
        client.disconnect();
        return;
      }

      const socketData = this.getSocketData(client);
      socketData.userId = payload.sub;
      socketData.userName = payload.name || 'Unknown user';
      socketData.color = this.getUserColor(payload.sub);

      this.logger.log(
        `Client connected: ${socketData.userName} (${client.id})`,
      );
    } catch {
      this.logger.warn(`WebSocket connection rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const socketData = this.getSocketData(client);
    if (!socketData.userId) {
      return;
    }

    // Notify all rooms this user was in
    client.rooms.forEach((room) => {
      if (room !== client.id) {
        this.removeFromRoom(room, socketData.userId as string);
        client.to(room).emit('user-left', { userId: socketData.userId });
      }
    });

    this.logger.log(
      `Client disconnected: ${socketData.userName} (${client.id})`,
    );
  }

  // ──── Page room management ────

  @SubscribeMessage('join-page')
  async handleJoinPage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string },
  ) {
    const socketData = this.getSocketData(client);
    if (!socketData.userId || !socketData.userName || !socketData.color) {
      client.emit('error', { message: 'Unauthorized socket session' });
      return;
    }

    const room = `page:${data.pageId}`;
    await client.join(room);

    const user: ConnectedUser = {
      userId: socketData.userId,
      userName: socketData.userName,
      color: socketData.color,
    };

    this.addToRoom(room, user);

    // Notify others in room
    client.to(room).emit('user-joined', user);

    // Send list of currently connected users to the joining client
    const currentUsers = this.getRoomUsers(room);
    client.emit('room-users', currentUsers);

    this.logger.log(`${user.userName} joined page ${data.pageId}`);
  }

  @SubscribeMessage('leave-page')
  async handleLeavePage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string },
  ) {
    const socketData = this.getSocketData(client);
    if (!socketData.userId) {
      return;
    }

    const room = `page:${data.pageId}`;
    await client.leave(room);

    this.removeFromRoom(room, socketData.userId);
    client.to(room).emit('user-left', { userId: socketData.userId });
  }

  // ──── Block operations — save to DB + broadcast ────

  @SubscribeMessage('block-update')
  async handleBlockUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { pageId: string; blockId: string; content: string; type?: string },
  ) {
    try {
      const socketData = this.getSocketData(client);
      if (!socketData.userId) {
        client.emit('error', { message: 'Unauthorized socket session' });
        return;
      }

      await this.blocksService.update(
        data.blockId,
        { content: data.content, type: data.type },
        socketData.userId,
      );
    } catch (error) {
      client.emit('error', {
        message: 'Failed to update block',
        error: String(error),
      });
    }
  }

  @SubscribeMessage('block-create')
  async handleBlockCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      pageId: string;
      type: string;
      content?: string;
      sortOrder?: number;
    },
  ) {
    try {
      const socketData = this.getSocketData(client);
      if (!socketData.userId) {
        client.emit('error', { message: 'Unauthorized socket session' });
        return;
      }

      const block = await this.blocksService.create(
        data.pageId,
        { type: data.type, content: data.content, sortOrder: data.sortOrder },
        socketData.userId,
      );

      // Confirm to sender with the created block (includes generated ID)
      client.emit('block-created-ack', { block });
    } catch (error) {
      client.emit('error', {
        message: 'Failed to create block',
        error: String(error),
      });
    }
  }

  @SubscribeMessage('block-delete')
  async handleBlockDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; blockId: string },
  ) {
    try {
      const socketData = this.getSocketData(client);
      if (!socketData.userId) {
        client.emit('error', { message: 'Unauthorized socket session' });
        return;
      }

      await this.blocksService.remove(data.blockId, socketData.userId);
    } catch (error) {
      client.emit('error', {
        message: 'Failed to delete block',
        error: String(error),
      });
    }
  }

  @SubscribeMessage('block-reorder')
  async handleBlockReorder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; blockIds: string[] },
  ) {
    try {
      const socketData = this.getSocketData(client);
      if (!socketData.userId) {
        client.emit('error', { message: 'Unauthorized socket session' });
        return;
      }

      await this.blocksService.reorder(
        data.pageId,
        { blockIds: data.blockIds },
        socketData.userId,
      );
    } catch (error) {
      client.emit('error', {
        message: 'Failed to reorder blocks',
        error: String(error),
      });
    }
  }

  // ──── Cursor tracking ────

  @SubscribeMessage('cursor-move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; position: Record<string, unknown> },
  ) {
    const socketData = this.getSocketData(client);
    if (!socketData.userId || !socketData.userName || !socketData.color) {
      return;
    }

    client.to(`page:${data.pageId}`).emit('cursor-moved', {
      userId: socketData.userId,
      userName: socketData.userName,
      color: socketData.color,
      position: data.position,
    });
  }

  // ──── Private helpers ────

  private getUserColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0;
    }
    return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
  }

  private addToRoom(room: string, user: ConnectedUser): void {
    if (!this.roomUsers.has(room)) {
      this.roomUsers.set(room, new Map());
    }
    this.roomUsers.get(room)!.set(user.userId, user);
  }

  private removeFromRoom(room: string, userId: string): void {
    this.roomUsers.get(room)?.delete(userId);
    if (this.roomUsers.get(room)?.size === 0) {
      this.roomUsers.delete(room);
    }
  }

  private getRoomUsers(room: string): ConnectedUser[] {
    const users = this.roomUsers.get(room);
    return users ? Array.from(users.values()) : [];
  }

  private getSocketData(client: Socket): CollaborationSocketData {
    return client.data as CollaborationSocketData;
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const tokenFromAuth = typeof auth?.token === 'string' ? auth.token : null;

    const authorizationHeader = client.handshake.headers.authorization;
    const tokenFromHeader =
      typeof authorizationHeader === 'string'
        ? authorizationHeader.replace(/^Bearer\s+/i, '')
        : null;

    return tokenFromAuth || tokenFromHeader;
  }
}
