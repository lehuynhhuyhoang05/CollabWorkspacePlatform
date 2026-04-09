# CONTEXT — Đọc file này đầu tiên mỗi session

## Project là gì?
Collaborative Workspace Platform — Notion-like, deploy Oracle Cloud.
Đồ án môn Cloud Computing, báo cáo cuối tháng 4.

## Tôi là ai?
- Làm backend (NestJS + TypeScript) + toàn bộ DevOps/infra
- Dùng AI agent để code — cần context rõ ràng
- Teammate làm frontend (Next.js + Tiptap)

---

## ⚠️ Chiến lược 2 giai đoạn (QUAN TRỌNG)

### Giai đoạn 1 — Bây giờ đến đầu tháng 4 (ĐANG LÀM)
**Phát triển local, KHÔNG có Oracle Cloud.**
- Database: **PostgreSQL** (Docker local)
- Object Storage: **MinIO** (Docker local)
- Cache: Redis (Docker local)
- Chạy bằng: `cd backend && docker compose -f docker-compose.local.yml up -d`
- Env file: `.env.local` → copy thành `.env`

### Giai đoạn 2 — Đầu tháng 4 (sau khi có Oracle Cloud mới)
**Migrate lên Oracle Cloud — chỉ đổi config, không đổi code logic.**
- Đổi `DB_TYPE=postgres` → `DB_TYPE=oracle` + Oracle connection string
- Đổi `STORAGE_TYPE=minio` → `STORAGE_TYPE=oci` + OCI credentials
- Chạy TypeORM migrations lên Oracle DB
- Setup VM + CI/CD

---

## Stack tóm tắt

### Hiện tại (local dev)
| Thành phần | Công nghệ |
|---|---|
| Backend | NestJS + TypeScript |
| Database | **PostgreSQL:16** (Docker) |
| Object Storage | **MinIO** (Docker) |
| Cache | Redis:7 (Docker) |
| Realtime | Socket.io |

### Production sau này (Oracle Cloud)
| Thành phần | Công nghệ |
|---|---|
| Backend | NestJS + TypeScript (giống hệt) |
| Database | **Oracle Autonomous DB** |
| Object Storage | **Oracle Object Storage** |
| Cache | Redis:7 (Docker on VM) |
| Compute | Oracle VM ARM (Always Free) |
| CI/CD | GitHub Actions |
| Proxy | Nginx + Let's Encrypt |

---

## Cấu trúc thư mục project
```
Project/
├── .agent/               ← Agent context (file này + rules + skills)
│   ├── CONTEXT.md
│   ├── RULES.md
│   ├── SKILLS.md
│   ├── SKILL_STORAGE.md
│   ├── PROGRESS.md
│   └── TASKS.md
├── docs/                 ← Project documentation
│   ├── PROJECT.md
│   └── FRONTEND_GUIDE.md
├── backend/              ← NestJS app
│   ├── src/
│   ├── docker-compose.local.yml
│   ├── .env.local
│   └── ...
├── .cursorrules
└── .gitignore
```

## Files quan trọng
| File | Nội dung |
|---|---|
| `docs/PROJECT.md` | Toàn bộ spec: tech stack, schema, API endpoints, WebSocket events |
| `.agent/RULES.md` | Nguyên tắc code bắt buộc phải theo |
| `.agent/SKILLS.md` | Code patterns sẵn có (9 skills) |
| `.agent/SKILL_STORAGE.md` | Storage abstraction MinIO/OCI |
| `.agent/PROGRESS.md` | Snapshot tiến độ ngắn, đọc sau CONTEXT để làm tiếp ngay |
| `.agent/TASKS.md` | Danh sách task theo sprint |
| `backend/docker-compose.local.yml` | Docker local (PostgreSQL + MinIO + Redis) |
| `backend/.env.local` | Env vars cho local dev |
| `backend/.env.production.example` | Template env cho Oracle Cloud |

---

## TypeORM — viết code LOCAL-FIRST

Khi code bây giờ, dùng **PostgreSQL types** trong entities.
Khi migrate sang Oracle (đầu tháng 4), tìm-replace toàn bộ:

```
'varchar'  → 'varchar2'
'text'     → 'clob'
'int'      → 'number'
```

> Agent: ĐANG ở Giai đoạn 1 — dùng PostgreSQL types, KHÔNG dùng Oracle types.

---

## Storage Service
Dùng abstraction layer — xem `.agent/SKILL_STORAGE.md`
- `STORAGE_TYPE=minio` → dùng MinioStorageService (local)
- `STORAGE_TYPE=oci` → dùng OciStorageService (production)
- Inject qua token: `@Inject('STORAGE_SERVICE')`

---

## Trạng thái hiện tại
> Cập nhật dòng này sau mỗi task hoàn thành

- [x] Sprint 1: Hoàn thành nền tảng backend local
- [x] Sprint 2: Hoàn thành phần lớn core features (workspace/page/block/comment/search/storage)
- [/] Sprint 3: Đã có realtime gateway, còn thiếu test và hardening
- [/] Sprint 4: Đã có version history + search + upload local; còn share + tối ưu
- [ ] Sprint 5: Chưa bắt đầu
