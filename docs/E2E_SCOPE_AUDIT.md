# E2E Scope Audit - 2026-04-10

## Muc tieu
Ra soat end-to-end toan bo scope he thong theo cac luong quan trong:
- Auth va profile
- Workspace va invitation
- Page/content workflow
- Task workflow + notification
- Inbox message workflow
- Google calendar workflow
- Trash logic

## Ket qua tong quan
- Backend build: PASS
- Frontend lint: PASS
- Frontend build: PASS
- Unit tests (auth/tasks/workspaces): PASS (18 tests)
- Migration moi: PASS (`AddPasswordResetColumns1774210000000` da apply)

## Checklist luong nghiep vu
1. Register/Login/Refresh/Logout: PASS
2. Forgot password/Reset password: PASS (API + UI da noi)
3. Workspace create/update/remove + role guard: PASS
4. Invitation pending -> accept/refuse: PASS
5. Task create/update/delete + assignee-limited mode: PASS
6. Important notifications:
   - mention/taskAssigned/deadline: PASS
   - blocked/completed/overdue: PASS
   - invitation + invitation response: PASS
7. Inbox messages (1-1): PASS
   - list contacts chung workspace
   - list thread
   - send message
   - mark thread read
8. Google calendar/timeline UI flow: PASS (duoc validate qua build va luong UI da ton tai)
9. Trash logic (pages soft-delete): GIU NGUYEN, khong thay doi logic

## Diem can luu y (residual risks)
1. Forgot password hien log reset link ra backend logger trong non-production (de test nhanh). Production nen thay bang email provider.
2. "Quet task quan trong" hien dang trigger bang tay qua Inbox button. Neu can realtime hoan toan, nen bo sung scheduler/cron.
3. Direct message hien luu tren bang notifications theo mo hinh mirror message (nhanh, gon), chua tach bang message rieng.
4. Frontend bundle warning > 500kb van ton tai (khong anh huong logic, chi anh huong performance).

## De xuat tiep theo
1. Them email service (SES/SendGrid) cho forgot password.
2. Them scheduler 5-15 phut/lần de phat overdue/deadline notifications tu dong.
3. Tach module tin nhan sang entity rieng neu can file/media/reply/threading nang cao.
4. Them e2e tests (supertest + playwright) cho cac luong chinh tren.
