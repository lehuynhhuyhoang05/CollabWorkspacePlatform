# Implementation Plan (Execution Tracker)

Date: 2026-04-07
Owner: FE + BE incremental delivery

## Goal
Stabilize production logic first, then close feature gaps toward Notion-like experience without breaking current MVP.

## Current Focus
- [x] P0.1 Add DB migration for comments resolve/reopen + tasks table
- [x] P0.2 Fix backend unit test mismatch in search service spec
- [x] P0.3 Align task update RBAC with My Tasks practical workflow
- [x] P0.4 Re-run quality gates (backend tests/build + frontend check)
- [x] P0.5 Quick manual smoke checklist for critical paths

## Phase P0 (Stability First)
### Scope
- Ensure schema is migration-safe when DB_SYNCHRONIZE=false
- Ensure unit tests are green and match current query-builder behavior
- Remove FE/BE logic mismatch for task updates in My Tasks

### Definition of Done
- Migration file exists and is reversible
- backend npm run test + npm run build pass
- frontend npm run check pass
- No known blocker in create/edit task and comment resolve/reopen flows

### P0 Delivery Log (2026-04-07)
- Added migration: AddTasksAndCommentWorkflow1774173000000
- Backend unit tests: 7/7 suites passed
- Backend e2e tests: 2/2 suites passed
- Backend build: passed
- Frontend check (lint + build): passed

## Phase P1 (API-to-UI Completion)
- [x] Wire Page versions history + restore in UI
- [x] Wire block reorder API in UI (drag/drop or move controls)
- [x] Wire comment update (edit mode) in UI
- [x] Add focused tests for new task/comment workflows

### P1 Delivery Log (2026-04-07)
- Frontend: Added Version History card with restore action in Page Detail
- Frontend: Added block move up/down controls using reorder API
- Frontend: Added inline comment edit mode (author-only) wired to comment update API
- Backend tests: Added task update RBAC spec and extended comment resolve/reopen spec
- Validation: backend test/build/e2e and frontend check all passed

## Phase P2 (Notion-like Productivity)
- [x] Mentions + notification inbox center
- [x] Reminder workflow (deadline and mention-triggered)
- [x] Workspace-level activity feed
- [x] Task relation/rollup MVP

### P2 Delivery Log (2026-04-07)
- Backend: added Notifications module with inbox APIs, mark-read APIs, due-soon reminder trigger API, workspace activity feed API
- Backend: comment create/update now parses mentions (@email) and generates mention notifications + activity records
- Backend: task create/update/delete now generates activity records; assignment + deadline reminder notifications
- Backend: task relation/rollup MVP added via parent task and related page fields, with rollup summary in task payload
- Backend: added migration AddNotificationsActivityAndTaskRelations1774179000000
- Frontend: added Inbox page, topbar unread badge, mark-read/mark-all actions, and manual due reminder trigger
- Frontend: added workspace activity feed panel in workspace detail page
- Frontend: extended tasks UI with parent-task + related-page linking and rollup visualization
- Validation: backend test/build/e2e and frontend lint/check all passed

## Phase P3 (Google Integrations)
- [x] Google OAuth connect flow
- [x] Calendar event create/sync (1-way then 2-way)
- [x] Meet link generation attached to events/tasks
- [x] Audit logs + retry policy for sync jobs

### P3 Delivery Log (2026-04-09)
- Backend: added `google-integrations` module (OAuth URL/code exchange, connection status/disconnect, calendar event create, sync queue run/list, audit logs)
- Backend: added entities/tables `google_accounts`, `google_calendar_sync_jobs`, `google_integration_audit_logs`
- Backend: added retry policy with exponential backoff (`pending/processing/retrying/completed/failed`) and persisted attempts/next retry timestamp
- Backend: extended tasks with `googleEventId`, `googleCalendarId`, `googleMeetUrl` to persist event/Meet mapping on task
- Backend: added migration `AddGoogleIntegrationsAndSyncJobs1774185000000`
- Frontend: added Google OAuth callback route/page and Profile integration controls (connect/reconnect/disconnect, run sync jobs)
- Frontend: added task-level actions to create Google event + Meet link, queue sync jobs, and display event/Meet metadata in table/board/calendar views
- Frontend: added recent sync jobs + audit logs panels in Profile
- Validation: backend `npm run test`, `npm run build`, `npm run test:e2e` and frontend `npm run check` all passed

### P3 Extension Log (2026-04-09 - Calendar UX + 2-way Sync)
- Backend: added event detail/update endpoint with attendee + recurrence + all-day/timed support and ETag optimistic concurrency checks.
- Backend: added RSVP endpoint to update attendee response status.
- Backend: added bidirectional sync endpoint with conflict strategies: `mark`, `prefer_google`, `prefer_task`.
- Backend: added task sync metadata columns + migration `1774192000000-AddGoogleSyncMetadataColumns` for conflict detection/resolution bookkeeping.
- Frontend: upgraded Tasks page with week/month Google calendar view and drag-drop reschedule between day cells.
- Frontend: added full Event Editor UI (summary/description/location, all-day or timed, recurrence, attendee list management, RSVP action).
- Frontend: added sync control panel to run 2-way sync and display task conflicts.
- Validation: diagnostics clean on changed files, backend tests/build/e2e passed, frontend lint/build passed.

## Notes
- Keep changes small and mergeable per phase.
- Prefer migration-driven schema updates over synchronize in shared/prod environments.
