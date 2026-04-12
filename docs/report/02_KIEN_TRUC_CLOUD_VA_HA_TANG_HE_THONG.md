# Kiến Trúc Cloud Và Hạ Tầng Hệ Thống

## 1. Cloud được sử dụng ở đâu

### 1.1 Hạ tầng (IaaS)

- AWS EC2: chạy toàn bộ dịch vụ production.
- AWS Security Group: kiểm soát truy cập mạng 22/80/443.
- EBS: lưu trữ persistent volume cho container data.

### 1.2 Dịch vụ DevOps (SaaS)

- GitHub Actions: build, deploy tự động.
- GitHub Secrets: quản lý thông tin nhạy cảm cho pipeline.

## 2. Kiến trúc tổng thể

```mermaid
flowchart LR
    User["Người dùng Web"] -->|HTTPS| Domain["api.huyhoang05.id.vn"]
    Domain --> Nginx["Nginx Reverse Proxy trên EC2"]

    Nginx -->|/| Frontend["Frontend Container\nnginx static"]
    Nginx -->|/api/*, /health| Backend["Backend Container\nNestJS"]
    Nginx -->|/socket.io/*| Backend

    Backend --> Postgres[(PostgreSQL)]
    Backend --> Redis[(Redis)]
    Backend --> MinIO[(MinIO)]

    Actions["GitHub Actions"] -->|SSH + SCP| EC2["AWS EC2"]
    EC2 --> Nginx
```

## 3. Topology triển khai production

```mermaid
flowchart TB
    subgraph Internet
        Browser[Client Browser]
        Runner[GitHub Hosted Runner]
    end

    subgraph AWS["AWS - 1 EC2 Instance"]
        SG["Security Group\n22,80,443"]

        subgraph Compose["Docker Compose"]
            C1[collab-nginx]
            C2[collab-frontend]
            C3[collab-backend]
            C4[collab-postgres]
            C5[collab-redis]
            C6[collab-minio]
            C7[collab-certbot]
        end
    end

    Browser -->|443| SG --> C1
    C1 --> C2
    C1 --> C3
    C3 --> C4
    C3 --> C5
    C3 --> C6

    Runner -->|22| SG
```

## 4. Bản đồ route ở tầng reverse proxy

- `/` -> frontend container.
- `/api/*` -> backend container.
- `/health` -> backend health endpoint.
- `/socket.io/*` -> backend websocket transport.

## 5. Liên kết giữa các lớp

1. Lớp truy cập internet đi qua Nginx.
2. Lớp ứng dụng xử lý nghiệp vụ ở backend.
3. Lớp dữ liệu lưu trong Postgres/Redis/MinIO.
4. Lớp vận hành dùng GitHub Actions tác động lên EC2 qua SSH.

## 6. Điểm mạnh kiến trúc hiện tại

- Đơn giản, dễ triển khai, phù hợp phạm vi đồ án.
- Đồng nhất môi trường nhờ container.
- Dễ trình bày luồng cloud end-to-end trong vấn đáp.

## 7. Giới hạn hiện tại

- Single instance nên chưa có tính sẵn sàng cao.
- Dịch vụ dữ liệu self-managed tăng tải vận hành.
- CI/CD phụ thuộc khả năng SSH từ runner tới VM.

## 8. Hướng nâng cấp cloud-native

- Postgres -> Amazon RDS.
- Redis -> ElastiCache.
- MinIO -> S3.
- Bổ sung load balancer + đa instance backend.
- Tích hợp monitoring/alerting tập trung.
