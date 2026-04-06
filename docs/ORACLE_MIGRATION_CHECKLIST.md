# Oracle Migration Checklist (PostgreSQL -> Oracle)

> Legacy reference only. Default deployment flow is now AWS-first in `docs/PRODUCTION_RUNBOOK.md`.

## 1. Pre-flight

- [ ] Oracle Autonomous DB đã tạo xong, có user/schema riêng cho app.
- [ ] VM có kết nối outbound tới Oracle endpoint (port 1522/1521 theo service).
- [ ] Backup dữ liệu PostgreSQL hiện tại (logical dump).
- [ ] Xác nhận `DB_SYNCHRONIZE=false` trong môi trường production.

## 2. Environment switch

- [ ] Trên VM, copy file mẫu: `cp backend/.env.vm.example backend/.env`.
- [ ] Cập nhật giá trị:
  - [ ] `DB_TYPE=oracle`
  - [ ] `ORACLE_USER`
  - [ ] `ORACLE_PASSWORD`
  - [ ] `ORACLE_CONNECTION_STRING`
  - [ ] `STORAGE_TYPE=oci` (nếu chuyển sang OCI Object Storage)
- [ ] Restart stack: `docker compose -f docker-compose.prod.yml up -d --build`.

## 3. Migration execution

- [ ] Kiểm tra migrations pending:
  - `npm run migration:show`
- [ ] Chạy migration:
  - `npm run migration:run`
- [ ] Nếu lỗi migration:
  - [ ] Chụp log lỗi đầy đủ
  - [ ] `npm run migration:revert` (nếu cần rollback lần gần nhất)
  - [ ] Sửa migration rồi chạy lại

## 4. Data validation

- [ ] Kiểm tra bảng chính đã tồn tại: `users`, `workspaces`, `workspace_members`, `pages`, `blocks`, `comments`, `page_versions`, `page_shares`.
- [ ] Kiểm tra ràng buộc FK hoạt động khi xóa workspace/page.
- [ ] Thực hiện smoke flow:
  - [ ] register/login
  - [ ] create workspace
  - [ ] create page + blocks
  - [ ] create share link
  - [ ] search theo title/content

## 5. Post-cutover

- [ ] Bật monitor log ứng dụng 24h đầu.
- [ ] Theo dõi lỗi auth refresh token/reuse detection.
- [ ] Xác nhận upload file hoạt động đúng storage backend mong muốn.
- [ ] Chốt snapshot release + ghi lại migration đã áp dụng.

## 6. Rollback plan

- [ ] Có backup PostgreSQL trước cutover.
- [ ] Lưu file `.env` bản cũ (PostgreSQL mode).
- [ ] Nếu rollback:
  - [ ] Restore `.env` cũ (`DB_TYPE=postgres`, `STORAGE_TYPE=minio`)
  - [ ] Redeploy stack
  - [ ] Verify `/health` và đăng nhập thành công
