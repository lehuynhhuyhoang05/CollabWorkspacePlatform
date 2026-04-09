# Task Breakdown — Synced With Current Codebase

## Trạng thái cập nhật
- Last sync: 2026-03-22
- Phase hiện tại: Local-first (PostgreSQL + MinIO + Redis)
- Mục tiêu: ổn định backend MVP, rồi mới mở rộng CI/CD + Oracle migration

---

## Đã hoàn thành trong code

### Core nền tảng
- [x] NestJS project bootstrap, global prefix `/api/v1` (exclude `/health`)
- [x] ConfigModule + env validation (Joi)
- [x] Global ValidationPipe + HttpExceptionFilter + TransformInterceptor
- [x] Helmet + CORS + Swagger (non-production)
- [x] Throttler guard global (rate limit cơ bản)

### Modules đã implement
- [x] Auth (register/login/refresh/logout/me)
- [x] Users (me/update me)
- [x] Workspaces + member management
- [x] Pages (tree, CRUD, move, soft delete, version list/restore, export markdown)
- [x] Blocks (CRUD + reorder)
- [x] Comments (CRUD)
- [x] Search (workspace search)
- [x] Storage (upload/delete với MinIO qua `STORAGE_SERVICE`)
- [x] Share tối thiểu (tạo link token + đọc page theo token)
- [x] Collaboration gateway (join/leave, block events, cursor events)
- [x] Health endpoint `/health`

### Hạ tầng local
- [x] `docker-compose.local.yml` với postgres + minio + redis
- [x] Build backend pass (`npm run build`)
- [x] E2E baseline pass (`npm run test:e2e`)

---

## Còn thiếu hoặc cần nâng cấp gấp

### Chất lượng và an toàn
- [x] Tạo TypeORM migrations thực tế (initial schema + scripts + test run/revert)
- [x] Viết unit tests cho service quan trọng (auth/workspaces/pages/blocks)
- [x] Áp RBAC nhất quán theo role owner/editor/viewer cho endpoint mutate
- [x] Bổ sung membership check cho comments theo workspace

### Tối ưu trước demo
- [x] Tối ưu search baseline (normalize query + cap limit + dedupe)
- [x] Thêm throttle chuyên biệt cho refresh endpoint
- [/] Tối ưu search nâng cao (đã có index/search tuning migration, còn benchmark dữ liệu lớn)
- [ ] Tăng bảo mật refresh flow (reuse telemetry + incident handling)
- [ ] Chuẩn hoá logging để debug demo dễ hơn

### DevOps/Cloud
- [x] `.github/workflows/deploy.yml` (skeleton)
- [ ] Deploy pipeline end-to-end lên VM
- [/] Nginx + SSL automation đã có, còn gắn domain thật + verify end-to-end
- [ ] Oracle migration phase 2 (DB + Storage) khi có tài nguyên cloud mới

### Pre-server nâng cao
- [x] Runbook production 1 file (deploy/verify/rollback/ssl/troubleshooting)
- [x] API contract + Postman collection cho frontend
- [x] Seed demo data automation (`npm run seed:demo`)
- [x] Tài liệu trạng thái áp dụng công nghệ (Redis/WebSocket/Storage/etc.)

---

## Priority Queue (làm theo thứ tự)

### P0 — Làm ngay (1-3 ngày)
- [x] P0.1: Tạo migration initial schema + script migrate/revert
- [x] P0.2: Khóa RBAC cho endpoint ghi dữ liệu
- [x] P0.3: Viết test unit cho auth.service và workspaces.service

### P1 — Trước khi ghép frontend lớn (3-5 ngày)
- [x] P1.1: Test unit pages.service + blocks.service
- [x] P1.2: Cứng hoá comments authorization
- [x] P1.3: Tối ưu search query + giới hạn truy vấn
- [x] P1.4: Unit test search.service + storage.controller
- [x] P1.5: Integration/e2e RBAC mutate paths (pages/comments)
- [x] P1.6: Share module tối thiểu + migration `page_shares`

### P2 — Trước demo cloud
- [x] P2.1: Thiết lập GitHub Actions deploy (skeleton)
- [/] P2.2: Nginx + HTTPS automation đã có, còn domain thật + verify
- [ ] P2.3: Checklist migrate Oracle (DB_TYPE/STORAGE_TYPE)

---

## Cách gọi agent theo task
- "Làm P0.1: tạo migration initial schema và script npm cho migrate/revert."
- "Làm P0.2: áp RBAC owner/editor/viewer cho workspaces/pages/blocks/comments."
- "Làm P0.3: viết unit test cho auth.service và workspaces.service."
