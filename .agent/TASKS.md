# Task Breakdown — Sprint by Sprint

## Cách dùng file này
Mỗi khi bắt đầu làm việc, báo cho agent biết đang ở task nào.
Ví dụ: "Tôi muốn làm Task 1.2 — Setup TypeORM Oracle"

---

## Sprint 1 — Nền tảng (Tuần 1)

### Task 1.1 — NestJS Project Init
- [ ] `nest new backend --package-manager npm`
- [ ] Cài dependencies: `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `typeorm`, `oracledb`, `bcrypt`, `class-validator`, `class-transformer`, `ioredis`, `socket.io`
- [ ] Setup `app.module.ts` với ConfigModule global
- [ ] Setup global pipes, filters, interceptors trong `main.ts`
- [ ] Tạo `/health` endpoint

**Output**: Project chạy được, `/health` trả về `{ status: 'ok' }`

---

### Task 1.2 — Setup TypeORM Oracle
- [ ] Tạo `config/database.config.ts` đọc từ env
- [ ] Config TypeORM với Oracle dialect trong `app.module.ts`
- [ ] Test kết nối Oracle Autonomous DB thành công
- [ ] Tạo `common/utils/uuid.util.ts`

**Output**: App kết nối được Oracle DB, không lỗi

---

### Task 1.3 — Auth Module
- [ ] Tạo `users` module + entity + migration
- [ ] Tạo `auth` module
- [ ] `POST /auth/register` — hash password bcrypt
- [ ] `POST /auth/login` — trả access token (15m) + refresh token (7d)
- [ ] `POST /auth/refresh` — refresh access token
- [ ] `POST /auth/logout` — invalidate refresh token
- [ ] `GET /auth/me` — trả user hiện tại
- [ ] `JwtAuthGuard`, `CurrentUser` decorator
- [ ] Không return password trong response

**Output**: Đăng ký, đăng nhập, refresh token hoạt động

---

### Task 1.4 — Oracle Cloud Infra (DevOps)
- [ ] Tạo VCN + subnet + internet gateway trên Oracle Cloud
- [ ] Tạo VM ARM (Always Free) — Ubuntu 22.04
- [ ] Mở port 22, 80, 443 trong Security List
- [ ] Cài Docker + Docker Compose trên VM
- [ ] Tạo Oracle Autonomous DB — download Wallet
- [ ] Tạo Object Storage bucket `collab-workspace`
- [ ] Generate API key cho OCI CLI
- [ ] Test kết nối DB từ local

**Output**: VM chạy, DB accessible, bucket tạo xong

---

## Sprint 2 — Core Features (Tuần 2)

### Task 2.1 — Workspaces Module
- [ ] Entity: `workspace`, `workspace_member`
- [ ] Migration tạo 2 tables
- [ ] CRUD đầy đủ (xem API Endpoints trong PROJECT.md)
- [ ] Invite member bằng token link (7 ngày expire)
- [ ] Guard: chỉ workspace member mới access được

**Output**: Tạo workspace, invite member, phân role hoạt động

---

### Task 2.2 — Pages Module
- [ ] Entity: `page`, `page_version`
- [ ] Migration
- [ ] CRUD pages (nested với parent_id)
- [ ] `GET /workspaces/:wid/pages` — trả cây pages dạng nested tree
- [ ] Soft delete (`is_deleted = 1`)
- [ ] Move page (đổi parent)
- [ ] Export Markdown (convert blocks JSON → .md string)

**Output**: Tạo page lồng nhau, move, soft delete

---

### Task 2.3 — Blocks Module
- [ ] Entity: `block`
- [ ] Migration
- [ ] CRUD blocks
- [ ] `content` field là CLOB lưu Tiptap JSON
- [ ] Reorder blocks (update sort_order hàng loạt)

**Output**: Tạo/sửa/xoá/reorder blocks

---

### Task 2.4 — CI/CD Pipeline (DevOps)
- [ ] Tạo `Dockerfile` multi-stage cho backend
- [ ] Tạo `docker-compose.yml` (backend + redis + nginx)
- [ ] Tạo `.github/workflows/deploy.yml`
- [ ] Setup GitHub Secrets: `ORACLE_VM_IP`, `ORACLE_SSH_KEY`, secrets env
- [ ] Setup Nginx config cơ bản (HTTP trước, HTTPS sau)
- [ ] Test: push code → GitHub Actions chạy → deploy lên VM

**Output**: CI/CD pipeline chạy end-to-end

---

## Sprint 3 — Realtime (Tuần 3)

### Task 3.1 — WebSocket Gateway
- [ ] Cài `@nestjs/websockets`, `socket.io`
- [ ] Tạo `collaboration.gateway.ts`
- [ ] Auth khi connect (verify JWT)
- [ ] Events: `join-page`, `leave-page`
- [ ] Presence: `user-joined`, `user-left`
- [ ] Test với 2 browser tabs

**Output**: Connect WebSocket, join room, thấy user khác

---

### Task 3.2 — Realtime Block Sync
- [ ] Events: `block-update`, `block-create`, `block-delete`, `block-reorder`
- [ ] Save to DB + broadcast to room
- [ ] Last-write-wins (không cần OT)
- [ ] `cursor-move` event + broadcast

**Output**: 2 người cùng edit page — thay đổi sync realtime

---

### Task 3.3 — Redis Pub/Sub (optional nếu dư thời gian)
- [ ] Cài `@socket.io/redis-adapter`
- [ ] Config Redis adapter cho Socket.io
- [ ] Test với 2 instance backend chạy song song

**Output**: Realtime hoạt động dù có nhiều container

---

### Task 3.4 — Comments Module
- [ ] Entity: `comment`
- [ ] CRUD comments per block
- [ ] Broadcast `comment-added` qua WebSocket khi có comment mới

**Output**: Comment trên block, realtime notify

---

## Sprint 4 — Polish (Tuần 4)

### Task 4.1 — Version History
- [ ] Auto-save version sau mỗi 30s idle (dùng debounce ở client)
- [ ] Hoặc trigger từ server sau mỗi WebSocket save
- [ ] `GET /pages/:id/versions` — list versions
- [ ] Preview version (trả snapshot JSON)
- [ ] `POST /pages/:id/versions/restore` — rollback

**Output**: Xem lịch sử, rollback về bản cũ

---

### Task 4.2 — Search
- [ ] Raw Oracle SQL query full-text search
- [ ] Search theo title + block content
- [ ] `GET /workspaces/:wid/search?q=...`

**Output**: Tìm kiếm trong workspace

---

### Task 4.3 — File Upload (Oracle Object Storage)
- [ ] Cài `oci-objectstorage`
- [ ] `POST /storage/upload` — upload file, trả objectName
- [ ] Generate pre-signed URL khi cần hiển thị
- [ ] Validate: chỉ cho upload image, max 5MB

**Output**: Upload ảnh, lưu Oracle Object Storage, hiển thị được

---

### Task 4.4 — Share & Permissions
- [ ] Share link public (generate token, view-only)
- [ ] Share với user cụ thể (assign quyền)
- [ ] Guard kiểm tra quyền per-page

**Output**: Tạo share link, người không có tài khoản xem được

---

### Task 4.5 — SSL + Domain (DevOps)
- [ ] Trỏ domain về Oracle VM IP
- [ ] Certbot Let's Encrypt trong Docker
- [ ] Update Nginx config HTTPS
- [ ] Test toàn bộ flow trên HTTPS

**Output**: App chạy trên HTTPS với domain thật

---

## Sprint 5 — Báo cáo (Tuần 5)

### Task 5.1 — Health & Monitoring
- [ ] `/health` endpoint chi tiết (DB, Redis status)
- [ ] Structured logging với NestJS Logger
- [ ] Log request/response time

### Task 5.2 — Chuẩn bị demo
- [ ] Tạo seed data (workspace mẫu, pages mẫu)
- [ ] Script tạo 3 test accounts sẵn
- [ ] Test luồng demo end-to-end
- [ ] Chuẩn bị: mở 3 tab sẵn, join cùng 1 page

### Task 5.3 — Báo cáo
- [ ] Architecture diagram
- [ ] CI/CD flow diagram
- [ ] Demo video backup (phòng mạng yếu)
