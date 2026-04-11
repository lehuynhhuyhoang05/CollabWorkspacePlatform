# Production Runbook (AWS-First, Single Flow)

Muc tieu: 1 luong duy nhat de deploy va van hanh backend tren AWS EC2 cho demo cuoi thang.

Quick pre-demo sequence:
- docs/DEMO_TMINUS_30_CHECKLIST.md

## 1. Target architecture

Tren 1 EC2 chay bang docker compose:
- collab-frontend (static frontend qua nginx)
- collab-backend (NestJS)
- collab-postgres (PostgreSQL)
- collab-redis (Redis)
- collab-minio + collab-minio-setup (object storage)
- collab-nginx (reverse proxy)
- collab-certbot (SSL issue/renew)

## 2. One-time setup on AWS

### 2.1 Create EC2 (Ubuntu 22.04)
- Instance type: Free Tier eligible
- Storage: >= 20 GB
- Security Group inbound:
  - 22 (SSH)
  - 80 (HTTP)
  - 443 (HTTPS)

### 2.2 Install Docker and Compose plugin

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 2.3 Prepare app directory

```bash
sudo mkdir -p /opt/collab
sudo chown -R $USER:$USER /opt/collab
cd /opt/collab
git clone <your-repo-url> .
cd backend
cp .env.vm.example .env
```

## 3. CI/CD setup (GitHub Actions)

Workflow: .github/workflows/deploy.yml

Canonical production secrets (recommended):
- PROD_SSH_HOST
- PROD_SSH_USER
- PROD_SSH_PRIVATE_KEY
- PROD_DEPLOY_PATH
- PROD_FRONTEND_API_BASE_URL
- PROD_FRONTEND_URL
- PROD_GOOGLE_CLIENT_ID
- PROD_GOOGLE_CLIENT_SECRET
- PROD_GOOGLE_REDIRECT_URI
- PROD_GOOGLE_SCOPES

Optional TLS secrets:
- PROD_DOMAIN
- PROD_CERTBOT_EMAIL

Legacy fallback secrets currently still supported by workflow:
- AWS_EC2_HOST, AWS_EC2_USER, AWS_EC2_SSH_PRIVATE_KEY, AWS_DEPLOY_PATH
- ORACLE_VM_IP, ORACLE_VM_USER, ORACLE_SSH_PRIVATE_KEY, DEPLOY_PATH, DEPLOY_USER
- DOMAIN, CERTBOT_EMAIL
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_SCOPES
- FRONTEND_API_BASE_URL, FRONTEND_URL

Push to main to auto deploy.

### 3.1 End-to-end CI validation checklist

1. Push 1 small commit to `main`.
2. Open Actions run for `.github/workflows/deploy.yml`.
3. Verify `Build Backend` and `Deploy To VM` are both green.
4. Verify runtime after run:

```bash
curl -i https://api.huyhoang05.id.vn/
curl -i https://api.huyhoang05.id.vn/health
curl -i https://api.huyhoang05.id.vn/privacy-policy
curl -i https://api.huyhoang05.id.vn/terms
```

5. Only after at least one successful CI deploy, remove any server-side polling deploy cron.

## 4. Deploy (manual fallback)

```bash
cd <AWS_DEPLOY_PATH>/backend
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
```

## 5. Verify

### 5.1 Containers

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected: backend, postgres, redis, minio, nginx are Up.

### 5.2 Health

```bash
curl -i http://<ec2-public-ip>/health
```

Expected: HTTP 200 and `status: ok`.

### 5.3 DB migration + seed

```bash
npm run migration:show
npm run migration:run
npm run seed:demo
```

### 5.4 Critical smoke

1. Register/Login
2. Create workspace
3. Create page + blocks
4. Create share link and open /api/v1/share/:token
5. Search in workspace
6. Viewer tries to edit page -> must return 403

## 6. SSL (when domain is ready)

### 6.1 One-time issue certificate

```bash
cd <AWS_DEPLOY_PATH>/backend
export DOMAIN=api.your-domain.com
export CERTBOT_EMAIL=admin@your-domain.com
sh scripts/enable-https.sh
```

### 6.2 Renew certificate

```bash
cd <AWS_DEPLOY_PATH>/backend
sh scripts/renew-ssl.sh
```

### 6.3 Recommended daily cron

```cron
0 3 * * * cd <AWS_DEPLOY_PATH>/backend && sh scripts/renew-ssl.sh >> /var/log/collab-ssl-renew.log 2>&1
```

## 7. Rollback

### 7.1 Fast redeploy rollback

```bash
cd <AWS_DEPLOY_PATH>/backend
git checkout <last-known-good-tag-or-commit>
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
```

### 7.2 Migration rollback (last migration only)

```bash
cd <AWS_DEPLOY_PATH>/backend
npm run migration:revert
```

Dung khi da danh gia tac dong du lieu.

## 8. Troubleshooting

### 8.1 Health fail
- Check backend logs:

```bash
docker compose -f docker-compose.prod.yml logs backend --tail=200
```

### 8.2 Search endpoint error
- Ensure latest migration was applied.
- Check index migration status.

### 8.3 SSL issue (certbot challenge fail)
- Verify DNS A record points to EC2 public IP.
- Verify port 80 open in Security Group.
- Verify Nginx can serve /.well-known/acme-challenge/.

### 8.4 API unreachable via domain
- Check nginx logs:

```bash
docker compose -f docker-compose.prod.yml logs nginx --tail=200
```

### 8.5 Auth refresh 429
- Current limit is 8 requests per 60s.
- Check frontend refresh loop behavior.

## 9. Cost control (important for $100 credit)

- Stop EC2 when not testing.
- Avoid over-allocating EBS.
- Delete unused snapshots/volumes after test rounds.
- Keep one small EC2 for demo period only.

## 10. Final operational checklist

- [ ] Deploy success
- [ ] Migration success
- [ ] Seed success
- [ ] Health check 200
- [ ] Smoke flow pass
- [ ] SSL valid (if domain enabled)
- [ ] Rollback path confirmed
- [ ] GitHub Actions deploy run passed end-to-end at least once
- [ ] Server-side polling deploy cron removed
