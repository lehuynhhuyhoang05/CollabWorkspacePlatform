import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { BlocksService } from '../blocks/blocks.service';
import { PagesService } from '../pages/pages.service';

interface ConnectedUser {
  userId: string;
  userName: string;
  color: string;
}

const CURSOR_COLORS = [
  '#F87171', '#60A5FA', '#34D399', '#FBBF24',
  '#A78BFA', '#F472B6', '#FB923C', '#2DD4BF',
];

@WebSocketGateway({
  namespace: '/collaboration',
  cors: {
    origin: '*', // Will be restricted via ConfigService in production
    credentials: true,
  },
})
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);

  // Track connected users per room for presence
  private readonly roomUsers = new Map<string, Map<string, ConnectedUser>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly blocksService: BlocksService,
    private readonly pagesService: PagesService,
  ) {}

  // ──── Connection lifecycle ────

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn('WebSocket connection rejected: no token');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.data.userId = payload.sub;
      client.data.userName = payload.name;
      client.data.color = this.getUserColor(payload.sub);

      this.logger.log(`Client connected: ${payload.name} (${client.id})`);
    } catch {
      this.logger.warn(`WebSocket connection rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (!client.data.userId) return;

    // Notify all rooms this user was in
    client.rooms.forEach((room) => {
      if (room !== client.id) {
        this.removeFromRoom(room, client.data.userId);
        client.to(room).emit('user-left', { userId: client.data.userId });
      }
    });

    this.logger.log(
      `Client disconnected: ${client.data.userName} (${client.id})`,
    );
  }

  // ──── Page room management ────

  @SubscribeMessage('join-page')
  async handleJoinPage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string },
  ) {
    const room = `page:${data.pageId}`;
    await client.join(room);

    const user: ConnectedUser = {
      userId: client.data.userId,
      userName: client.data.userName,
      color: client.data.color,
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
    const room = `page:${data.pageId}`;
    await client.leave(room);

    this.removeFromRoom(room, client.data.userId);
    client.to(room).emit('user-left', { userId: client.data.userId });
  }

  // ──── Block operations — save to DB + broadcast ────

  @SubscribeMessage('block-update')
  async handleBlockUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { pageId: string; blockId: string; content: string; type?: string },
  ) {
    try {
      await this.blocksService.update(
        data.blockId,
        { content: data.content, type: data.type },
        client.data.userId,
      );

      client.to(`page:${data.pageId}`).emit('block-updated', {
        blockId: data.blockId,
        content: data.content,
        type: data.type,
        userId: client.data.userId,
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to update block', error: String(error) });
    }
  }

  @SubscribeMessage('block-create')
  async handleBlockCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { pageId: string; type: string; content?: string; sortOrder?: number },
  ) {
    try {
      const block = await this.blocksService.create(
        data.pageId,
        { type: data.type, content: data.content, sortOrder: data.sortOrder },
        client.data.userId,
      );

      client.to(`page:${data.pageId}`).emit('block-created', {
        block,
        userId: client.data.userId,
      });

      // Confirm to sender with the created block (includes generated ID)
      client.emit('block-created-ack', { block });
    } catch (error) {
      client.emit('error', { message: 'Failed to create block', error: String(error) });
    }
  }

  @SubscribeMessage('block-delete')
  async handleBlockDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; blockId: string },
  ) {
    try {
      await this.blocksService.remove(data.blockId, client.data.userId);

      client.to(`page:${data.pageId}`).emit('block-deleted', {
        blockId: data.blockId,
        userId: client.data.userId,
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to delete block', error: String(error) });
    }
  }

  @SubscribeMessage('block-reorder')
  async handleBlockReorder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; blockIds: string[] },
  ) {
    try {
      await this.blocksService.reorder(
        data.pageId,
        { blockIds: data.blockIds },
        client.data.userId,
      );

      client.to(`page:${data.pageId}`).emit('block-reordered', {
        blockIds: data.blockIds,
        userId: client.data.userId,
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to reorder blocks', error: String(error) });
    }
  }

  // ──── Cursor tracking ────

  @SubscribeMessage('cursor-move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pageId: string; position: Record<string, unknown> },
  ) {
    client.to(`page:${data.pageId}`).emit('cursor-moved', {
      userId: client.data.userId,
      userName: client.data.userName,
      color: client.data.color,
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
    return Array.from(this.roomUsers.get(room)?.values() || []);
  }
}
