# Quy Trinh Test Chuc Nang Frontend (Tieng Viet)

Tai lieu nay huong dan test chuc nang theo tung buoc de xac nhan logic app hoat dong dung.

## 1. Chuan bi

1. Kiem tra backend:

   curl -I https://api.huyhoang05.id.vn/health

2. Kiem tra CORS cho frontend local:

   curl -I -H "Origin: http://localhost:5173" https://api.huyhoang05.id.vn/health

3. Kiem tra bien moi truong:

   VITE_API_BASE_URL=https://api.huyhoang05.id.vn/api/v1

4. Chay frontend:

   npm run dev

## 2. Cong vao chat luong

1. Chay:

   npm run check

2. Chi tiep tuc test tay khi lint/build deu pass.

## 3. Luong test chuc nang

### 3.1 Auth

1. Dang ky voi du lieu sai de check validation (email, password yeu).
2. Dang ky voi du lieu hop le.
3. Dang xuat.
4. Dang nhap lai va refresh trang.

Ky vong:

1. Validation hien dung.
2. Dang ky thanh cong vao duoc /workspaces.
3. Dang xuat quay ve /login.
4. Refresh van giu session hop le.

### 3.2 Workspace

1. Tao workspace.
2. Doi ten workspace.
3. Mo workspace detail.
4. Xoa workspace test.

Ky vong:

1. Danh sach cap nhat ngay.
2. Du lieu van dung sau refresh.

### 3.3 Workspace detail

1. Tao page moi.
2. Moi thanh vien bang email (editor/viewer).
3. Doi role va remove member.
4. Search trong workspace va click ket qua.

Ky vong:

1. Cay page va bang member cap nhat dung.
2. Search ra ket qua lien quan va dieu huong dung page.

### 3.4 Page detail

1. Sua metadata page (title/icon).
2. Tao, sua, xoa block.
3. Them va xoa comment.
4. Upload anh va xoa object da upload.
5. Export markdown.
6. Tao share link va mo bang incognito.

Ky vong:

1. Moi thao tac persist sau refresh.
2. Share page xem duoc khong can login.

### 3.5 Realtime

1. Mo cung 1 page bang 2 tai khoan.
2. Kiem tra presence.
3. Sua block o tab A, tab B nhan update.

Ky vong:

1. Dong bo realtime on dinh, khong loop reconnect.

### 3.6 RBAC

1. Owner: full quyen.
2. Editor: sua noi dung duoc.
3. Viewer: khong sua duoc noi dung.

Ky vong:

1. Quyen duoc ap dung dung theo vai tro.
2. Loi cam quyen hien ro rang, UI khong vo.

## 4. Kiem tra giao dien

1. Chrome desktop.
2. Edge desktop.
3. Mobile viewport (devtools).

Ky vong:

1. Khong vo layout o login, workspace list, page detail, share page.

## 5. Tieu chi Pass

Chi danh dau PASS khi:

1. npm run check pass.
2. Tat ca luong test tren pass.
3. Khong con bug blocker/high.

## 6. Mau ghi loi

Khi loi, luu:

1. Feature bi loi.
2. Steps to reproduce.
3. Expected/Actual.
4. API endpoint + response.
5. Browser + timestamp.
