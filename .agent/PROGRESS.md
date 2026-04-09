# PROGRESS SNAPSHOT

Last update: 2026-04-09

## Read Order For New Session
1. `.agent/CONTEXT.md`
2. `.agent/PROGRESS.md` (file này)
3. `.agent/TASKS.md`
4. `docs/PROJECT.md`

## Current Reality (Backend)
- Build pass: `npm run build`
- E2E baseline pass: `npm run test:e2e`
- Unit tests baseline pass: `auth/workspaces/pages/blocks/comments/search/storage`
- Migration baseline ready: initial schema migration generated and verified (run/revert/run)
- RBAC write-path hardened: pages/blocks/comments require owner/editor for mutate actions
- Comments membership hardened: list/create/update/delete now verify workspace access
- Search optimized: normalized query, bounded limit (1-50), parallel title/content query, and deterministic dedupe
- RBAC integration/e2e added: mutate endpoints return 403 for viewer role
- Share module tối thiểu đã có: `POST /pages/:id/share`, `GET /share/:token`
- Migration mới: `1774162800000-AddPageShares.ts`
- Refresh endpoint đã thêm throttle riêng (`8 req / 60s`) để giảm abuse
- CI/CD skeleton đã có: `.github/workflows/deploy.yml` + `backend/docker-compose.prod.yml`
- HTTPS automation đã có: `backend/scripts/enable-https.sh` + `backend/scripts/renew-ssl.sh`
- Oracle VM env template đã có: `backend/.env.vm.example`
- Oracle cutover checklist đã có: `docs/ORACLE_MIGRATION_CHECKLIST.md`
- Production runbook 1 file đã có: `docs/PRODUCTION_RUNBOOK.md`
- Frontend API contract + Postman collection đã có
- Seed demo tự động đã có: `npm run seed:demo`
- Tài liệu trạng thái công nghệ đã có: `docs/TECH_STATUS.md`
- Checklist 30 phút trước demo đã có: `docs/DEMO_TMINUS_30_CHECKLIST.md`
- REST modules done: auth, users, workspaces, pages, blocks, comments, search, storage, health
- WebSocket done: collaboration gateway with page join/leave, block sync events, cursor events
- Local infra ready: postgres + minio + redis via `docker-compose.local.yml`

## Current Reality (Today - 2026-04-09)
- Google integration flow completed end-to-end: OAuth connect/exchange/disconnect + status + audit/sync job APIs.
- Advanced Google Calendar capabilities are now available in backend:
	- Event detail/update API (supports attendee + recurring + all-day/timed update).
	- RSVP update API per attendee.
	- Bidirectional sync task <-> Google event with conflict strategy (`mark`, `prefer_google`, `prefer_task`).
	- ETag optimistic check to prevent overwrite when event changed remotely.
- Task sync metadata persisted in DB/model:
	- `google_event_etag`, `google_event_updated_at`, `google_task_last_synced_at`, `google_last_pulled_at`, `google_sync_conflict_at`, `google_sync_conflict_message`.
- Frontend Tasks page upgraded:
	- Week/Month calendar board.
	- Drag-drop reschedule event between days.
	- Full Event Editor (summary, location, description, all-day/timed, recurrence).
	- Attendee management + RSVP status update.
	- Bidirectional sync controls and conflict list rendering.
- Validation status for today's changes:
	- backend unit tests: passed
	- backend build: passed
	- backend e2e: passed
	- frontend lint/build: passed

## Biggest Gaps Now
- Oracle production deployment phase 2 (DB/storage thực tế + secret/provisioning)
- Cần gắn domain thật + secrets (`DOMAIN`, `CERTBOT_EMAIL`) trên GitHub
- Cần lịch chạy định kỳ `renew-ssl.sh` (cron/systemd timer) trên VM
- Cần apply migration index/search tuning lên môi trường deploy
- Cần chạy migration mới trên môi trường deploy để bật Google sync metadata columns trước release
- Cần smoke test tay luồng conflict 2 chiều trên môi trường thật

## Next 3 Tasks (strict order)
1. Run migration mới (`1774192000000-AddGoogleSyncMetadataColumns`) trên môi trường target
2. Smoke test tay full flow: week/month, drag-drop reschedule, event editor attendee/recurring, RSVP, conflict strategies
3. Chốt release/deploy checklist (secrets + Oracle cutover + SSL renew cron)

## Resume Tomorrow (Quick Start)
1. `cd backend && npm run migration:run`
2. `cd backend && npm run test:e2e`
3. `cd frontend && npm run lint && npm run build`
4. Mở app và test 3 case conflict:
	- `mark`: conflict phải hiển thị trong task.
	- `prefer_google`: local task bị update theo Google.
	- `prefer_task`: Google event bị update theo local task.

## Handy Commands
```bash
cd backend

docker compose -f docker-compose.local.yml up -d
npm install
npm run start:dev
npm run build
npm run test:e2e
npm run migration:show
npm run migration:run
npm run migration:revert
```
