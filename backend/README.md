# Backend - Collaborative Workspace

## Local Development

1. Start local infrastructure:

```bash
docker compose -f docker-compose.local.yml up -d
```

2. Install dependencies:

```bash
npm install
```

3. Create local env:

```bash
cp .env.local .env
```

4. Run backend:

```bash
npm run start:dev
```

5. Health check:

```bash
curl http://localhost:3000/health
```

## Migrations

```bash
npm run migration:show
npm run migration:run
npm run migration:revert
```

## Demo Seed Data

```bash
npm run seed:demo
```

Seed output includes:
- demo accounts
- workspace/page IDs
- a public share token for instant demo

Docs:
- `../docs/FRONTEND_API_CONTRACT.md`
- `../docs/postman/CollaborativeWorkspace.postman_collection.json`
- `../docs/PRODUCTION_RUNBOOK.md`
- `../docs/DEMO_TMINUS_30_CHECKLIST.md`

## Production Deploy (Skeleton)

- Workflow: `.github/workflows/deploy.yml`
- Runtime compose: `docker-compose.prod.yml` (backend + postgres + redis + minio + nginx)
- VM env template: `.env.vm.example`
- Preferred GitHub secrets naming now uses `PROD_*` variables (legacy secret names still supported during migration).
- Required GitHub repository secrets:
  - `AWS_EC2_HOST`
  - `AWS_EC2_USER`
  - `AWS_EC2_SSH_PRIVATE_KEY`
  - `AWS_DEPLOY_PATH`
  - Optional HTTPS: `DOMAIN`, `CERTBOT_EMAIL`

Server must already have:
- Docker + Docker Compose plugin installed
- `backend/.env` created on VM before first deploy
- Domain DNS A record trỏ về VM IP (nếu bật HTTPS)

Manual run on server:

```bash
cd <AWS_DEPLOY_PATH>/backend
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

# one-time SSL bootstrap (optional)
export DOMAIN=api.your-domain.com
export CERTBOT_EMAIL=admin@your-domain.com
sh scripts/enable-https.sh

# periodic renewal
sh scripts/renew-ssl.sh
```
