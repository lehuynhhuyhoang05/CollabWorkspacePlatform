# Agent Rules — Collaborative Workspace Platform

## Vai trò của agent
Bạn là senior backend engineer + DevOps engineer cho project này.
Đọc `docs/PROJECT.md` trước khi làm bất kỳ task nào.

---

## ⚠️ Phase-aware Development

### Phase 1 (HIỆN TẠI) — Local PostgreSQL
Dùng **PostgreSQL types** trong TypeORM entities.
```typescript
@Column({ type: 'varchar', length: 255 })   // strings
@Column({ type: 'text' })                    // long text / JSON
@Column({ type: 'int' })                     // numbers
@Column({ type: 'timestamp' })               // dates
@PrimaryColumn({ type: 'varchar', length: 36 }) // UUID PK
```

### Phase 2 (Đầu tháng 4) — Oracle Migration
Khi migrate sang Oracle Autonomous DB, tìm-replace:
```
'varchar'  → 'varchar2'
'text'     → 'clob'
'int'      → 'number'
```

> Agent: Kiểm tra `CONTEXT.md` để biết đang ở Phase nào.

---

## Nguyên tắc code

### Ngôn ngữ & Framework
- **Luôn dùng TypeScript** — không dùng JavaScript thuần
- **NestJS patterns** — Module/Controller/Service/Entity, không viết code ngoài pattern
- **Decorators** — dùng @nestjs decorators đúng cách
- **DTO validation** — mọi input phải có DTO với class-validator
- **Không dùng `any`** — luôn type rõ ràng

### Database
- **ORM**: TypeORM
- **ID**: dùng UUID v4 (varchar(36)), không dùng auto-increment số
- **Timestamp**: dùng TIMESTAMP, không dùng DATE
- **Text/JSON**: dùng `text` cho content JSON dài (blocks, snapshots)
- **Migration**: tạo migration file TypeORM cho mọi thay đổi schema — không ALTER trực tiếp

### Auth & Security
- **JWT Guard** trên mọi endpoint cần auth — không để endpoint public không cần thiết
- **Roles Guard** cho các action cần phân quyền (owner/editor/viewer)
- **Password**: bcrypt với salt rounds 12
- **Refresh token**: lưu hash trong DB, không lưu plain
- **CORS**: chỉ allow FRONTEND_URL từ env

### Error Handling
- Dùng NestJS built-in exceptions: `NotFoundException`, `ForbiddenException`, `BadRequestException`
- Không throw raw Error
- Global exception filter ở `common/filters/http-exception.filter.ts`

### Response format
Mọi response phải qua `TransformInterceptor` — format chuẩn:
```json
{
  "success": true,
  "data": { ... },
  "message": "optional"
}
```

---

## WebSocket Rules

- **Namespace**: `/collaboration`
- **Auth**: client phải gửi JWT token khi connect
- **Room**: mỗi pageId là 1 room Socket.io
- **Redis Pub/Sub**: dùng khi cần broadcast qua nhiều instance (scale sau)
- **Last-write-wins**: không implement OT/CRDT — đơn giản nhất là đủ

```typescript
// Pattern chuẩn cho WebSocket event
@SubscribeMessage('block-update')
async handleBlockUpdate(
  @ConnectedSocket() client: Socket,
  @MessageBody() dto: BlockUpdateDto,
) {
  // 1. Validate
  // 2. Save to DB
  // 3. Broadcast to room (exclude sender)
  client.to(`page:${dto.pageId}`).emit('block-updated', result);
}
```

---

## Storage Rules

- **Bucket name**: đọc từ env (`MINIO_BUCKET_NAME` local / `OCI_BUCKET_NAME` production)
- **File naming**: `{userId}/{uuid}.{ext}` — không dùng tên gốc của user
- **Content-Type**: luôn set đúng MIME type
- **Public URL**: generate pre-signed URL với expiry 1 giờ cho ảnh
- **Cleanup**: khi xoá page/block có ảnh, xoá luôn file trên Storage
- Dùng `IStorageService` abstraction — xem `SKILL_STORAGE.md`

---

## Docker Rules

- **Multi-stage build** — stage build + stage runtime
- **Non-root user** trong container
- **Health check** trong Dockerfile
- **Secrets** không bao giờ hardcode — luôn từ env

```dockerfile
# Pattern chuẩn
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
```

---

## CI/CD Rules (GitHub Actions)

- **Trigger**: push to `main` branch
- **Steps**: lint → test → build Docker image → push ghcr.io → SSH deploy
- **Secrets**: lưu trong GitHub Secrets, không trong file
- **Deploy**: `docker compose pull && docker compose up -d --no-deps app`
- **Rollback**: keep 2 image tags (`latest` + `sha-xxxxxxx`)

---

## Folder & Naming Convention

```
# Module mới — luôn tạo đủ 4 file
modules/xxx/
  xxx.module.ts
  xxx.controller.ts
  xxx.service.ts
  entities/xxx.entity.ts
  dto/create-xxx.dto.ts
  dto/update-xxx.dto.ts

# Tên file: kebab-case
# Tên class: PascalCase
# Tên variable/function: camelCase
# Tên constant: SCREAMING_SNAKE_CASE
# Tên DB table/column: snake_case
```

---

## Điều KHÔNG được làm

- ❌ Không dùng `console.log` trong production code — dùng NestJS Logger
- ❌ Không return password hash trong response bao giờ
- ❌ Không dùng `synchronize: true` TypeORM trong production
- ❌ Không commit `.env` file — chỉ commit `.env.example`
- ❌ Không dùng `any` type
- ❌ Không bỏ qua validation DTO
- ❌ Không viết raw SQL trừ khi TypeORM không support
- ❌ Không để credentials trong code

---

## Khi bắt đầu task mới

1. Đọc `docs/PROJECT.md` để hiểu context
2. Đọc `.agent/RULES.md` (file này)
3. Đọc `.agent/SKILLS.md` nếu task liên quan đến skill cụ thể
4. Kiểm tra module liên quan đã tồn tại chưa
5. Viết DTO trước, rồi Service, rồi Controller
6. Không tạo file thừa — chỉ tạo những gì task yêu cầu
