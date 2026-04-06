# Agent Skills — Reusable Patterns

## Skill 1: Tạo NestJS Module mới

Khi được yêu cầu tạo module `xxx`, tạo đủ các file sau theo thứ tự:

### 1. Entity
```typescript
// src/modules/xxx/entities/xxx.entity.ts
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('xxx')
export class Xxx {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string = uuidv4();

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
```

### 2. DTO
```typescript
// src/modules/xxx/dto/create-xxx.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateXxxDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
```

### 3. Service
```typescript
// src/modules/xxx/xxx.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Xxx } from './entities/xxx.entity';
import { CreateXxxDto } from './dto/create-xxx.dto';

@Injectable()
export class XxxService {
  constructor(
    @InjectRepository(Xxx)
    private readonly xxxRepository: Repository<Xxx>,
  ) {}

  async create(dto: CreateXxxDto, userId: string): Promise<Xxx> {
    const xxx = this.xxxRepository.create({ ...dto, createdBy: userId });
    return this.xxxRepository.save(xxx);
  }

  async findOne(id: string): Promise<Xxx> {
    const xxx = await this.xxxRepository.findOne({ where: { id } });
    if (!xxx) throw new NotFoundException('Xxx not found');
    return xxx;
  }
}
```

### 4. Controller
```typescript
// src/modules/xxx/xxx.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { XxxService } from './xxx.service';
import { CreateXxxDto } from './dto/create-xxx.dto';

@Controller('xxx')
@UseGuards(JwtAuthGuard)
export class XxxController {
  constructor(private readonly xxxService: XxxService) {}

  @Post()
  create(@Body() dto: CreateXxxDto, @CurrentUser('id') userId: string) {
    return this.xxxService.create(dto, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.xxxService.findOne(id);
  }
}
```

---

## Skill 2: WebSocket Gateway

```typescript
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ namespace: '/collaboration', cors: { origin: process.env.FRONTEND_URL } })
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.userName = payload.name;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // broadcast user-left to all rooms client was in
    client.rooms.forEach((room) => {
      if (room !== client.id) {
        client.to(room).emit('user-left', { userId: client.data.userId });
      }
    });
  }

  @SubscribeMessage('join-page')
  async handleJoinPage(@ConnectedSocket() client: Socket, @MessageBody() data: { pageId: string }) {
    const room = `page:${data.pageId}`;
    await client.join(room);
    // Notify others
    client.to(room).emit('user-joined', {
      userId: client.data.userId,
      name: client.data.userName,
      color: this.getUserColor(client.data.userId),
    });
  }

  @SubscribeMessage('block-update')
  async handleBlockUpdate(@ConnectedSocket() client: Socket, @MessageBody() dto: any) {
    // Save to DB via service
    // Broadcast to room excluding sender
    client.to(`page:${dto.pageId}`).emit('block-updated', {
      ...dto,
      userId: client.data.userId,
    });
  }

  private getUserColor(userId: string): string {
    const colors = ['#F87171','#60A5FA','#34D399','#FBBF24','#A78BFA','#F472B6'];
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  }
}
```

---

## Skill 3: Oracle Object Storage Upload

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as common from 'oci-common';
import * as os from 'oci-objectstorage';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private client: os.ObjectStorageClient;
  private namespace: string;
  private bucket: string;

  constructor(private config: ConfigService) {
    const provider = new common.SimpleAuthenticationDetailsProvider(
      config.get('OCI_TENANCY_OCID'),
      config.get('OCI_USER_OCID'),
      config.get('OCI_FINGERPRINT'),
      config.get('OCI_PRIVATE_KEY'),
      null,
      common.Region.fromRegionId(config.get('OCI_REGION')),
    );
    this.client = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });
    this.namespace = config.get('OCI_NAMESPACE');
    this.bucket = config.get('OCI_BUCKET_NAME');
  }

  async upload(userId: string, buffer: Buffer, mimeType: string, ext: string): Promise<string> {
    const objectName = `${userId}/${uuidv4()}.${ext}`;
    await this.client.putObject({
      namespaceName: this.namespace,
      bucketName: this.bucket,
      objectName,
      putObjectBody: buffer,
      contentType: mimeType,
    });
    return objectName; // lưu objectName vào DB, generate URL khi cần
  }

  async getPreSignedUrl(objectName: string, expiresInSeconds = 3600): Promise<string> {
    const response = await this.client.createPreauthenticatedRequest({
      namespaceName: this.namespace,
      bucketName: this.bucket,
      createPreauthenticatedRequestDetails: {
        name: `par-${Date.now()}`,
        objectName,
        accessType: os.models.CreatePreauthenticatedRequestDetails.AccessType.ObjectRead,
        timeExpires: new Date(Date.now() + expiresInSeconds * 1000),
      },
    });
    return `https://objectstorage.${this.client.region}.oraclecloud.com${response.preauthenticatedRequest.accessUri}`;
  }

  async delete(objectName: string): Promise<void> {
    await this.client.deleteObject({
      namespaceName: this.namespace,
      bucketName: this.bucket,
      objectName,
    });
  }
}
```

---

## Skill 4: Oracle Text Full-text Search

TypeORM không support Oracle Text natively — dùng raw query:

```typescript
// search.service.ts
async search(workspaceId: string, query: string) {
  // Oracle Text CONTAINS operator
  const results = await this.dataSource.query(`
    SELECT p.id, p.title, p.icon, b.content, b.type
    FROM pages p
    LEFT JOIN blocks b ON b.page_id = p.id
    WHERE p.workspace_id = :workspaceId
      AND p.is_deleted = 0
      AND (
        UPPER(p.title) LIKE UPPER(:likeQuery)
        OR DBMS_LOB.INSTR(b.content, :query) > 0
      )
    FETCH FIRST 20 ROWS ONLY
  `, {
    workspaceId,
    query,
    likeQuery: `%${query}%`,
  });
  return results;
}
```

---

## Skill 5: Version History Auto-save

```typescript
// Trong pages.service.ts — gọi sau mỗi lần save
async createVersion(pageId: string, userId: string): Promise<void> {
  // Lấy tất cả blocks hiện tại
  const blocks = await this.blocksRepository.find({
    where: { pageId },
    order: { sortOrder: 'ASC' },
  });

  // Tạo snapshot JSON
  const snapshot = JSON.stringify(blocks);

  // Chỉ lưu nếu khác version trước
  const lastVersion = await this.pageVersionRepository.findOne({
    where: { pageId },
    order: { createdAt: 'DESC' },
  });

  if (lastVersion?.snapshot === snapshot) return; // không có gì thay đổi

  await this.pageVersionRepository.save({
    id: uuidv4(),
    pageId,
    snapshot,
    createdBy: userId,
  });

  // Giữ tối đa 50 versions per page — xoá cũ nhất
  const count = await this.pageVersionRepository.count({ where: { pageId } });
  if (count > 50) {
    const oldest = await this.pageVersionRepository.findOne({
      where: { pageId },
      order: { createdAt: 'ASC' },
    });
    await this.pageVersionRepository.delete(oldest.id);
  }
}
```

---

## Skill 6: GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Oracle Cloud

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/backend:latest
            ghcr.io/${{ github.repository }}/backend:${{ github.sha }}

      - name: Deploy to Oracle VM via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.ORACLE_VM_IP }}
          username: ubuntu
          key: ${{ secrets.ORACLE_SSH_KEY }}
          script: |
            cd /home/ubuntu/collab-workspace
            echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            docker compose pull backend
            docker compose up -d --no-deps --force-recreate backend
            docker image prune -f
```

---

## Skill 7: Docker Compose production

```yaml
# docker-compose.yml
version: '3.9'

services:
  backend:
    image: ghcr.io/${GITHUB_REPO}/backend:latest
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./wallet:/app/wallet:ro       # Oracle Wallet
      - ./oci_key.pem:/app/oci_key.pem:ro
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot_data:/var/www/certbot:ro
    depends_on:
      - backend

volumes:
  redis_data:
  certbot_data:
```

---

## Skill 8: Nginx config với SSL

```nginx
# nginx/nginx.conf
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # REST API
    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://backend:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend (nếu deploy cùng VM)
    location / {
        proxy_pass http://frontend:3001/;
        proxy_set_header Host $host;
    }
}
```
