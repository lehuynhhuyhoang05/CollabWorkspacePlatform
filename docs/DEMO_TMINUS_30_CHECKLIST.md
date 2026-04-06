# Demo Checklist T-30 (AWS-First)

Muc tieu: 30 phut truoc demo, chay dung thu tu nay.

## T-30 -> T-20: Bring stack up

1. SSH vao EC2:

```bash
cd <AWS_DEPLOY_PATH>/backend
```

2. Deploy ban moi nhat:

```bash
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
```

3. Kiem tra container:

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected: backend/postgres/redis/minio/nginx deu Up.

## T-20 -> T-15: Health + migration

4. Health:

```bash
curl -i https://<domain>/health
# neu chua ssl: curl -i http://<ec2-public-ip>/health
```

5. Migration check + run:

```bash
npm run migration:show
npm run migration:run
```

## T-15 -> T-10: Seed demo

6. Tao du lieu demo:

```bash
npm run seed:demo
```

7. Ghi lai output:
- demo owner/editor/viewer
- workspaceId
- pageId
- share token

## T-10 -> T-5: Business smoke

8. Chay nhanh:
- login owner
- mo workspace
- mo page + blocks
- mo share link public
- search workspace

9. RBAC smoke:
- login viewer
- thu edit page -> phai 403

## T-5 -> T-0: Final ready

10. SSL renew check (neu da co domain):

```bash
sh scripts/renew-ssl.sh
```

11. Chuan bi 3 tab demo:
- Owner
- Viewer
- Public share link

12. De san lenh rollback terminal:

```bash
cd <AWS_DEPLOY_PATH>/backend
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
```

## Go / No-Go

Go khi du 4 dieu kien:
- [ ] /health = 200
- [ ] seed thanh cong
- [ ] share link mo duoc
- [ ] viewer edit bi chan (403)

Neu fail bat ky dieu kien nao: No-Go tam thoi, redeploy roi check lai tu buoc Health.
