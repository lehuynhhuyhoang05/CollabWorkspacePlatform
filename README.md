# Collaborative Workspace Platform

Nền tảng ghi chú và cộng tác theo nhóm — giống Notion, deploy trên Oracle Cloud.
**Đồ án môn Cloud Computing.**

## Tech Stack

- **Backend**: NestJS + TypeScript
- **Database**: PostgreSQL (local) → Oracle Autonomous DB (production)
- **Object Storage**: MinIO (local) → Oracle Object Storage (production)
- **Cache/Realtime**: Redis + Socket.io
- **CI/CD**: GitHub Actions → Docker → Oracle VM
- **Frontend**: Next.js + Tiptap (teammate)

## Quick Start

```bash
# 1. Start infrastructure (PostgreSQL + MinIO + Redis)
cd backend
docker compose -f docker-compose.local.yml up -d

# 2. Install dependencies
npm install

# 3. Setup env
cp .env.local .env

# 4. Run dev server
npm run start:dev

# 5. Check health
curl http://localhost:3000/health
```

## Project Structure

```
├── .agent/          → AI agent context files
├── docs/            → Project documentation
├── backend/         → NestJS application
│   ├── src/
│   │   ├── config/      → Database, Redis configs
│   │   ├── modules/     → Feature modules
│   │   └── common/      → Guards, filters, interceptors
│   ├── docker-compose.local.yml
│   └── .env.local
└── .cursorrules     → IDE agent rules
```

## Documentation

- [Full Project Spec](docs/PROJECT.md)
- [Frontend Guide](docs/FRONTEND_GUIDE.md)
- [User Guide](docs/USER_GUIDE.md)
- [E2E Scope Audit](docs/E2E_SCOPE_AUDIT.md)
- [Frontend Test Workflow](docs/FRONTEND_TEST_WORKFLOW.md)
- [Frontend Test Workflow (VI)](docs/FRONTEND_TEST_WORKFLOW.vi.md)
- [Agent Rules](.agent/RULES.md)
- [Sprint Tasks](.agent/TASKS.md)
