# Collaborative Workspace Platform

## Tổng quan
Nền tảng ghi chú và cộng tác theo nhóm — giống Notion nhưng tự build và deploy trên AWS.
Đồ án môn Cloud Computing — báo cáo cuối tháng 4.

## Mục tiêu chính
1. **App hoạt động được thật** — block editor, realtime collab, version history
2. **CI/CD pipeline hoàn chỉnh** — push code → tự động deploy lên AWS EC2
3. **Toàn bộ infra cloud chạy ổn định trong budget Free Tier/Credit**

---

## Trạng thái triển khai hiện tại (codebase)

### Đã triển khai
- Auth, Users, Workspaces, Pages, Blocks, Comments, Search, Storage, Collaboration, Health
- Share module tối thiểu (`POST /pages/:id/share`, `GET /share/:token`)
- CI/CD skeleton tại `.github/workflows/deploy.yml`
- REST API prefix: `/api/v1` (riêng health là `/health`)
- Realtime Socket.io namespace: `/collaboration`
- Local infra: PostgreSQL + MinIO + Redis (`docker-compose.local.yml`)

### Chưa triển khai (planned)
- AWS production hardening (monitoring/backup/cost guard)

AWS-first runbook: `docs/PRODUCTION_RUNBOOK.md`
AWS pre-demo checklist: `docs/DEMO_TMINUS_30_CHECKLIST.md`
Legacy Oracle migration checklist (tham khảo): `docs/ORACLE_MIGRATION_CHECKLIST.md`
VM production env template: `backend/.env.vm.example`
HTTPS automation scripts: `backend/scripts/enable-https.sh`, `backend/scripts/renew-ssl.sh`
Frontend API contract: `docs/FRONTEND_API_CONTRACT.md`
Postman collection: `docs/postman/CollaborativeWorkspace.postman_collection.json`

---

## Tech Stack

### Backend (NestJS)
| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Framework | NestJS + TypeScript | Main backend framework |
| Realtime | Socket.io (@nestjs/websockets) | WebSocket cho collab |
| ORM | TypeORM | PostgreSQL (AWS-first), có thể mở rộng Oracle sau |
| Auth | JWT (@nestjs/jwt + passport) | Access + Refresh token |
| Cache / Realtime infra | Redis (container) | nền tảng cache/pubsub cho phase tiếp theo |
| File upload | MinIO adapter (S3-compatible) | Ảnh, cover image |
| Search | PostgreSQL ILIKE + index tuning | Full-text nâng cao ở phase sau |
| Validation | class-validator + class-transformer | DTO validation |
| Config | @nestjs/config | Env management |

### Database
- **PostgreSQL** chạy trong Docker stack trên AWS EC2 (AWS-first)
- ORM: TypeORM
- Có khả năng chuyển sang RDS/Oracle ở phase mở rộng

### Infrastructure (AWS-first)
| Service | Specs | Dùng cho |
|---|---|---|
| EC2 (Ubuntu) | Free Tier eligible | Chạy Docker containers |
| EBS | 20GB+ | Persistent volumes |
| Security Group | 22/80/443 | SSH + HTTP + HTTPS |
| Optional Route53 | Domain management | Trỏ domain cho demo |

### DevOps
| Thành phần | Công nghệ |
|---|---|
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Reverse Proxy | Nginx + Let's Encrypt (SSL) |
| Deployment target | AWS EC2 (SSH deploy) |

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
│   │   └── env.validation.ts
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
│   │   │   └── ...
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
│   │       ├── storage.controller.ts
│   │       ├── minio-storage.service.ts
│   │       └── storage.interface.ts
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

> Status: đã triển khai bản tối thiểu trong code hiện tại.

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
```

> `page-saved` hiện chưa emit trong gateway.

---

## Môi trường & Biến môi trường

### Local development (phase 1)

```env
NODE_ENV=development
PORT=3000

DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=collab_user
DB_PASSWORD=collab_pass
DB_NAME=collab_workspace
DB_SYNCHRONIZE=false
DB_LOGGING=false

STORAGE_TYPE=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=collab-workspace

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_refresh_secret
FRONTEND_URL=http://localhost:3001
```

### Production Oracle (phase 2)

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
