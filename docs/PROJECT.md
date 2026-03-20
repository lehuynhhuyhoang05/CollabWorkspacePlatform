# Collaborative Workspace Platform

## Tổng quan
Nền tảng ghi chú và cộng tác theo nhóm — giống Notion nhưng tự build và deploy trên Oracle Cloud.
Đồ án môn Cloud Computing — báo cáo cuối tháng 4.

## Mục tiêu chính
1. **App hoạt động được thật** — block editor, realtime collab, version history
2. **CI/CD pipeline hoàn chỉnh** — push code → tự động deploy lên Oracle Cloud
3. **Toàn bộ infra trên Oracle Always Free** — VM, DB, Object Storage

---

## Tech Stack

### Backend (NestJS)
| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Framework | NestJS + TypeScript | Main backend framework |
| Realtime | Socket.io (@nestjs/websockets) | WebSocket cho collab |
| ORM | TypeORM | Kết nối Oracle DB |
| Auth | JWT (@nestjs/jwt + passport) | Access + Refresh token |
| Cache / Pub-Sub | Redis (ioredis) | Sync WebSocket, session |
| File upload | Oracle Object Storage SDK | Ảnh, cover image |
| Search | Oracle Text (full-text) | Built-in trong Oracle DB |
| Validation | class-validator + class-transformer | DTO validation |
| Config | @nestjs/config | Env management |

### Database
- **Oracle Autonomous Database (Always Free)** — PostgreSQL-compatible mode
- ORM: TypeORM với Oracle dialect
- Connection: Oracle Thin JDBC / node-oracledb

### Infrastructure (Oracle Always Free)
| Service | Specs | Dùng cho |
|---|---|---|
| Compute VM (ARM) | 4 OCPU / 24GB RAM | Chạy Docker containers |
| Autonomous Database | 1 OCPU / 20GB | PostgreSQL-compatible |
| Object Storage | 20GB | File, ảnh upload |
| Virtual Cloud Network | - | Network isolation |

### DevOps
| Thành phần | Công nghệ |
|---|---|
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Reverse Proxy | Nginx + Let's Encrypt (SSL) |
| Registry | GitHub Container Registry (ghcr.io) |

### Frontend (do bạn teammate làm)
- Next.js + TypeScript
- Tiptap (block editor)
- Socket.io-client
- TailwindCSS

---

## Cấu trúc thư mục Backend

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   └── oracle-storage.config.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── jwt-refresh.strategy.ts
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       └── register.dto.ts
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.controller.ts
│   │   │   └── entities/user.entity.ts
│   │   ├── workspaces/
│   │   │   ├── workspaces.module.ts
│   │   │   ├── workspaces.service.ts
│   │   │   ├── workspaces.controller.ts
│   │   │   ├── entities/
│   │   │   │   ├── workspace.entity.ts
│   │   │   │   └── workspace-member.entity.ts
│   │   │   └── dto/
│   │   ├── pages/
│   │   │   ├── pages.module.ts
│   │   │   ├── pages.service.ts
│   │   │   ├── pages.controller.ts
│   │   │   ├── entities/
│   │   │   │   ├── page.entity.ts
│   │   │   │   └── page-version.entity.ts
│   │   │   └── dto/
│   │   ├── blocks/
│   │   │   ├── blocks.module.ts
│   │   │   ├── blocks.service.ts
│   │   │   ├── blocks.controller.ts
│   │   │   ├── entities/block.entity.ts
│   │   │   └── dto/
│   │   ├── collaboration/
│   │   │   ├── collaboration.module.ts
│   │   │   ├── collaboration.gateway.ts   ← WebSocket Gateway
│   │   │   ├── collaboration.service.ts
│   │   │   └── dto/
│   │   ├── comments/
│   │   │   ├── comments.module.ts
│   │   │   ├── comments.service.ts
│   │   │   ├── comments.controller.ts
│   │   │   └── entities/comment.entity.ts
│   │   ├── search/
│   │   │   ├── search.module.ts
│   │   │   ├── search.service.ts
│   │   │   └── search.controller.ts
│   │   └── storage/
│   │       ├── storage.module.ts
│   │       └── storage.service.ts         ← Oracle Object Storage
│   └── common/
│       ├── guards/
│       │   ├── jwt-auth.guard.ts
│       │   └── roles.guard.ts
│       ├── decorators/
│       │   ├── current-user.decorator.ts
│       │   └── roles.decorator.ts
│       ├── filters/
│       │   └── http-exception.filter.ts
│       └── interceptors/
│           └── transform.interceptor.ts
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Database Schema

### users
```sql
CREATE TABLE users (
  id          VARCHAR2(36) PRIMARY KEY,
  email       VARCHAR2(255) UNIQUE NOT NULL,
  name        VARCHAR2(255) NOT NULL,
  password    VARCHAR2(255) NOT NULL,
  avatar_url  VARCHAR2(500),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### workspaces
```sql
CREATE TABLE workspaces (
  id          VARCHAR2(36) PRIMARY KEY,
  name        VARCHAR2(255) NOT NULL,
  icon        VARCHAR2(10),
  owner_id    VARCHAR2(36) REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### workspace_members
```sql
CREATE TABLE workspace_members (
  id           VARCHAR2(36) PRIMARY KEY,
  workspace_id VARCHAR2(36) REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      VARCHAR2(36) REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR2(20) CHECK (role IN ('owner','editor','viewer')),
  joined_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, user_id)
);
```

### pages
```sql
CREATE TABLE pages (
  id           VARCHAR2(36) PRIMARY KEY,
  workspace_id VARCHAR2(36) REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id    VARCHAR2(36) REFERENCES pages(id),
  title        VARCHAR2(500) DEFAULT 'Untitled',
  icon         VARCHAR2(10),
  cover_url    VARCHAR2(500),
  is_deleted   NUMBER(1) DEFAULT 0,
  sort_order   NUMBER DEFAULT 0,
  created_by   VARCHAR2(36) REFERENCES users(id),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### blocks
```sql
CREATE TABLE blocks (
  id         VARCHAR2(36) PRIMARY KEY,
  page_id    VARCHAR2(36) REFERENCES pages(id) ON DELETE CASCADE,
  type       VARCHAR2(50) NOT NULL,  -- paragraph, heading1, heading2, heading3, bulletList, orderedList, taskList, codeBlock, image, divider
  content    CLOB,                   -- JSON string từ Tiptap
  sort_order NUMBER DEFAULT 0,
  created_by VARCHAR2(36) REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### page_versions
```sql
CREATE TABLE page_versions (
  id         VARCHAR2(36) PRIMARY KEY,
  page_id    VARCHAR2(36) REFERENCES pages(id) ON DELETE CASCADE,
  snapshot   CLOB NOT NULL,          -- JSON toàn bộ blocks tại thời điểm đó
  created_by VARCHAR2(36) REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### comments
```sql
CREATE TABLE comments (
  id         VARCHAR2(36) PRIMARY KEY,
  block_id   VARCHAR2(36) REFERENCES blocks(id) ON DELETE CASCADE,
  user_id    VARCHAR2(36) REFERENCES users(id),
  content    CLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### page_shares
```sql
CREATE TABLE page_shares (
  id         VARCHAR2(36) PRIMARY KEY,
  page_id    VARCHAR2(36) REFERENCES pages(id) ON DELETE CASCADE,
  user_id    VARCHAR2(36) REFERENCES users(id),    -- null nếu là public link
  token      VARCHAR2(100) UNIQUE,                  -- token cho public share link
  permission VARCHAR2(20) CHECK (permission IN ('view','edit')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Auth
```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
```

### Workspaces
```
GET    /workspaces                    -- list my workspaces
POST   /workspaces                    -- tạo workspace
GET    /workspaces/:id                -- chi tiết
PATCH  /workspaces/:id                -- update name/icon
DELETE /workspaces/:id                -- xoá
POST   /workspaces/:id/invite         -- invite member (gửi link)
GET    /workspaces/:id/members        -- list members
PATCH  /workspaces/:id/members/:uid   -- đổi role
DELETE /workspaces/:id/members/:uid   -- kick member
```

### Pages
```
GET    /workspaces/:wid/pages         -- cây pages (nested)
POST   /workspaces/:wid/pages         -- tạo page
GET    /pages/:id                     -- chi tiết page + blocks
PATCH  /pages/:id                     -- update title/icon/cover
DELETE /pages/:id                     -- soft delete
PATCH  /pages/:id/move                -- di chuyển parent
GET    /pages/:id/versions            -- list versions
POST   /pages/:id/versions/restore    -- rollback
GET    /pages/:id/export/markdown     -- export .md
```

### Blocks
```
GET    /pages/:pid/blocks             -- list blocks của page
POST   /pages/:pid/blocks             -- tạo block
PATCH  /blocks/:id                    -- update content
DELETE /blocks/:id                    -- xoá block
PATCH  /blocks/:id/move               -- reorder
```

### Comments
```
GET    /blocks/:bid/comments          -- list comments
POST   /blocks/:bid/comments          -- tạo comment
PATCH  /comments/:id                  -- edit comment
DELETE /comments/:id                  -- xoá comment
```

### Search
```
GET    /workspaces/:wid/search?q=...  -- full-text search
```

### Storage
```
POST   /storage/upload                -- upload file → Oracle Object Storage
DELETE /storage/:key                  -- xoá file
```

### Share
```
POST   /pages/:id/share               -- tạo share link / assign user
GET    /share/:token                  -- public access bằng token
```

---

## WebSocket Events (Socket.io)

### Client → Server
```
join-page       { pageId }                    -- vào phòng edit
leave-page      { pageId }                    -- rời phòng
block-update    { pageId, blockId, content }  -- gửi thay đổi block
block-create    { pageId, block }             -- tạo block mới
block-delete    { pageId, blockId }           -- xoá block
block-reorder   { pageId, blockIds[] }        -- reorder blocks
cursor-move     { pageId, position }          -- vị trí cursor
```

### Server → Client
```
user-joined     { userId, name, color }       -- user vào phòng
user-left       { userId }                    -- user rời phòng
block-updated   { blockId, content, userId }  -- broadcast thay đổi
block-created   { block, userId }             -- broadcast block mới
block-deleted   { blockId, userId }           -- broadcast xoá
block-reordered { blockIds[], userId }        -- broadcast reorder
cursor-moved    { userId, position }          -- broadcast cursor
page-saved      { versionId, savedAt }        -- auto-save confirm
```

---

## Môi trường & Biến môi trường

```env
# App
NODE_ENV=production
PORT=3000

# JWT
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# Oracle Database
ORACLE_USER=your_db_user
ORACLE_PASSWORD=your_db_password
ORACLE_CONNECTION_STRING=your_connection_string
ORACLE_WALLET_LOCATION=/app/wallet

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Oracle Object Storage
OCI_NAMESPACE=your_namespace
OCI_BUCKET_NAME=collab-workspace
OCI_REGION=ap-singapore-1
OCI_TENANCY_OCID=ocid1.tenancy...
OCI_USER_OCID=ocid1.user...
OCI_FINGERPRINT=...
OCI_PRIVATE_KEY_PATH=/app/oci_key.pem

# CORS
FRONTEND_URL=https://your-domain.com
```

---

## Phân công

### Bạn (Backend + DevOps)
- Toàn bộ NestJS backend
- Oracle Cloud setup (VM, DB, Object Storage, VCN)
- Docker + Docker Compose
- GitHub Actions CI/CD
- Nginx + SSL

### Teammate (Frontend)
- Next.js app
- Tiptap block editor integration
- Socket.io-client realtime
- UI/UX toàn bộ

---

## Lộ trình

| Tuần | Mục tiêu |
|---|---|
| 1 | Oracle infra setup + NestJS init + Auth + DB schema |
| 2 | Workspace/Pages/Blocks CRUD + CI/CD pipeline + deploy lần đầu |
| 3 | WebSocket Gateway + Realtime collab + Redis Pub/Sub |
| 4 | Version history + Search + Share link + Storage |
| 5 | Bug fix + Báo cáo + Rehearse demo |
