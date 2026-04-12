# Project Handover - Cloud Architecture & Runtime Flow

Cap nhat: 2026-04-11

## 1. Muc tieu do an

Do an xay dung mot nen tang ghi chu + cong tac nhom theo mo hinh Notion-like, nhan manh vao:

1. Backend co API + realtime hoat dong that.
2. Trien khai production tren cloud.
3. Co CI/CD de push main la tu dong deploy.

## 2. Cloud Computing dang duoc su dung o dau

### 2.1 Infrastructure as a Service (IaaS)

- AWS EC2: may chu production chay toan bo stack docker.
- AWS Security Group: kiem soat inbound 22/80/443.
- AWS EBS: luu tru persistent volume cho DB/Object storage/cache.

### 2.2 SaaS cho DevOps

- GitHub Actions: build + deploy tu dong khi push len nhanh main.
- GitHub Secrets: quan ly secret deploy/ung dung (PROD_*).

### 2.3 Nen tang ung dung tren cloud (self-managed tren EC2)

- PostgreSQL, Redis, MinIO khong dung managed service, ma duoc container hoa va chay tren cung EC2.
- Nginx reverse proxy + TLS (Let's Encrypt) cung chay tren EC2.

Ket luan cloud: he thong dang theo huong IaaS + containerized self-managed services. Chua len managed DB/object/cache.

## 3. Tong quan ha tang production

Thanh phan runtime theo docker compose production:

- collab-nginx: public entrypoint port 80/443
- collab-frontend: static frontend (nginx)
- collab-backend: NestJS API + WebSocket gateway
- collab-postgres: quan ly du lieu nghiep vu
- collab-redis: cache/realtime support
- collab-minio + collab-minio-setup: object storage
- collab-certbot: cap/renew SSL

Domain production hien tai: api.huyhoang05.id.vn

## 4. Cach cac thanh phan lien ket voi nhau

Luong request tu client:

1. Browser vao https://api.huyhoang05.id.vn
2. Nginx route:
   - / -> collab-frontend
   - /api/* -> collab-backend
   - /health -> collab-backend /health
   - /socket.io/* -> collab-backend socket layer
3. Backend truy cap Postgres/Redis/MinIO trong network noi bo docker.

Luong realtime:

1. Client ket noi Socket.IO namespace /collaboration.
2. Join room theo page: page:{pageId}.
3. CRUD block qua REST/socket deu ghi DB.
4. CollaborationEventsService phat su kien de gateway broadcast den cac client dang o cung room.

## 5. Cach CI/CD dang chay

Workflow: .github/workflows/deploy.yml

Pipeline hien tai:

1. Trigger: push vao main (paths backend/**, frontend/**, workflow).
2. Job Build Backend:
   - npm ci
   - npm run build
3. Job Deploy To VM:
   - build frontend artifact (frontend/dist)
   - preflight secrets
   - preflight network reachability den SSH host:port
   - tao deploy bundle, copy len VM qua scp
   - ssh vao VM, docker compose up -d --build --remove-orphans
   - migration run trong backend container
   - health check backend + nginx
   - neu deploy thanh cong: tu dong xoa cron poll-deploy.sh (fallback cu)

## 6. Trang thai hien tai (thuc te)

Da xong:

- Push main da trigger Actions tu dong.
- Build backend xanh.
- Workflow da co preflight de fail nhanh va bao loi ro.

Dang bi chan:

- Deploy job fail o buoc preflight network reachability.
- Ly do: GitHub runner khong vao duoc SSH port cua VM (timeout).
- Security Group hien dang cho SSH theo 1 IP /32 (IP may ca nhan), khong mo cho IP runner.

Noi cach khac: CI da auto, CD chua complete do network policy SSH.

## 7. Checklist de chot hoan toan mo hinh push-main-auto-deploy

1. Sua inbound rule SSH de runner vao duoc (tam thoi 0.0.0.0/0 de test nhanh).
2. Dam bao instance production gan dung Security Group vua sua.
3. Kiem tra firewall trong VM (ufw/iptables) dang mo dung SSH port.
4. Xac nhan secrets:
   - PROD_SSH_HOST
   - PROD_SSH_PORT
   - PROD_SSH_USER
   - PROD_SSH_PRIVATE_KEY
   - PROD_DEPLOY_PATH
5. Re-run workflow hoac push 1 commit nho.
6. Khi run xanh, xac nhan cron poll-deploy.sh da bi go.

## 8. Danh gia kien truc cloud cho bao cao do an

Diem manh:

- Trien khai duoc fullstack thuc te tren cloud VM.
- CI/CD co tu dong hoa va kiem soat preflight/health check.
- Kien truc container giup deploy dong nhat moi truong.

Gioi han hien tai:

- Cac service data la self-managed tren 1 EC2, chua managed cloud-native.
- Single-VM architecture chua co HA/multi-AZ.
- Secret/runtime governance can tiep tuc cung co.

Huong nang cap sau bao cao:

1. Tach Postgres sang RDS.
2. Chuyen object storage sang S3.
3. Dung ALB + ECS/EKS (hoac it nhat 2 VM + load balancer).
4. Them monitoring/logging tap trung (CloudWatch + alert).
5. Fine-grained network policy thay cho mo SSH rong.

## 9. Tai lieu lien quan

- docs/PROJECT.md
- docs/PRODUCTION_RUNBOOK.md
- docs/DEPLOY_SECRETS.md
- .github/workflows/deploy.yml
- backend/docker-compose.prod.yml
- backend/nginx/active.conf