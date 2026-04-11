# Production Deploy Secrets

This document is the single source of truth for production secrets used by `.github/workflows/deploy.yml`.

## Canonical secrets (set these first)

- `PROD_SSH_HOST`: public DNS or IP of production VM (example: `api.huyhoang05.id.vn`)
- `PROD_SSH_PORT`: SSH port of production VM (default: `22`)
- `PROD_SSH_USER`: SSH username on VM (example: `ubuntu`)
- `PROD_SSH_PRIVATE_KEY`: private key content (PEM) for SSH deploy
- `PROD_DEPLOY_PATH`: absolute path on VM repo root (example: `/home/ubuntu/CollabWorkspacePlatform`)

- `PROD_FRONTEND_API_BASE_URL`: API base URL used at frontend build time (example: `https://api.huyhoang05.id.vn/api/v1`)
- `PROD_FRONTEND_URL`: frontend origin(s) for backend CORS (example: `https://api.huyhoang05.id.vn`)

- `PROD_GOOGLE_CLIENT_ID`
- `PROD_GOOGLE_CLIENT_SECRET`
- `PROD_GOOGLE_REDIRECT_URI` (example: `https://api.huyhoang05.id.vn/integrations/google/callback`)
- `PROD_GOOGLE_SCOPES`

## Optional secrets

- `PROD_DOMAIN`: TLS domain for certbot scripts
- `PROD_CERTBOT_EMAIL`: certbot registration email

## Notes

- Workflow still accepts legacy secret names, but canonical `PROD_*` should be used for all new setups.
- Missing `PROD_SSH_PRIVATE_KEY` prevents GitHub Actions from deploying to VM.
- If Actions shows SSH timeout (`dial tcp ...:22 i/o timeout`), verify `PROD_SSH_HOST`, `PROD_SSH_PORT`, VM uptime, and inbound firewall/Security Group rule for SSH from GitHub runner.
- Missing `PROD_FRONTEND_API_BASE_URL` or `PROD_FRONTEND_URL` fails preflight by design.
- Missing Google secrets does not block deploy but will break Google integration flows at runtime.
