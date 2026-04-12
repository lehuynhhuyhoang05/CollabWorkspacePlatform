# Tổng Quan Và Mục Tiêu Đồ Án

## 1. Bối cảnh

Nhu cầu cộng tác trực tuyến theo thời gian thực ngày càng lớn trong môi trường học tập và doanh nghiệp. Các hệ thống dạng workspace giúp nhiều thành viên cùng làm việc trên một tập dữ liệu thống nhất, có phân quyền và lưu vết thay đổi.

## 2. Bài toán đồ án

Xây dựng nền tảng cộng tác kiểu Notion-lite, bao gồm:

- Quản lý người dùng, workspace và thành viên.
- Quản lý page/block và bình luận.
- Đồng bộ cập nhật realtime giữa nhiều client.
- Lưu trữ tệp đính kèm.
- Tìm kiếm dữ liệu trong workspace.
- Tích hợp Google phục vụ lịch/công việc ở mức nền tảng.

## 3. Mục tiêu kỹ thuật

### 3.1 Mục tiêu chức năng

- Đăng ký, đăng nhập, xác thực JWT.
- CRUD workspace/page/block/comment.
- Realtime collaboration cho thao tác block.
- Chia sẻ trang qua token.
- Tìm kiếm theo ngữ cảnh workspace.

### 3.2 Mục tiêu phi chức năng

- Triển khai production trên cloud thật.
- Có pipeline CI/CD tự động.
- Có health check và quy trình vận hành.
- Tách cấu hình qua biến môi trường và secrets.

## 4. Phạm vi triển khai

### 4.1 Trong phạm vi

- Fullstack web app.
- Production chạy trên AWS EC2 bằng Docker Compose.
- Reverse proxy, HTTPS, dịch vụ dữ liệu tự quản.

### 4.2 Ngoài phạm vi hiện tại

- Multi-region, multi-AZ.
- Auto-scaling ở mức cloud-native.
- Dịch vụ managed hoàn toàn cho DB/Cache/Object Storage.

## 5. Giá trị học thuật theo môn Cloud Computing

- Áp dụng IaaS để chạy ứng dụng thực tế trên cloud.
- Áp dụng SaaS (GitHub Actions) để tự động hóa vòng đời phần mềm.
- Thực hành bài toán vận hành: mạng, bảo mật, secrets, deploy và giám sát.
- Có thể phân tích trade-off giữa self-managed và managed services.

## 6. Kết quả kỳ vọng của hội đồng

- Hệ thống có thể demo end-to-end.
- Kiến trúc và luồng dữ liệu rõ ràng.
- Giải thích được vì sao chọn công nghệ và cách vận hành trên cloud.
- Có roadmap nâng cấp khi tăng quy mô.
