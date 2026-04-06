# Technology Adoption Status

## Implemented and active

- NestJS modular backend architecture
- TypeORM repositories + migrations
- PostgreSQL local runtime
- JWT auth (access + refresh rotation)
- Bcrypt password hashing
- Throttler global + refresh route throttle
- WebSocket collaboration via Socket.io (`/collaboration`)
- MinIO storage adapter (upload/delete/presigned URL)
- Docker local stack (Postgres + MinIO + Redis)
- Docker production stack (backend + postgres + redis + minio + nginx)
- GitHub Actions deploy skeleton (AWS-first secrets)
- HTTPS automation scripts with Certbot + Nginx

## Implemented but partial

- Redis: infrastructure is running, but app-level Redis integration (cache layer or socket redis-adapter) is not wired yet.
- Storage abstraction: `STORAGE_TYPE` exists, but OCI storage service implementation is pending.
- Search optimization: query-level optimization and index migration prepared; full-text engine upgrade pending for phase 2.

## Planned / pending

- AWS production hardening (monitoring, backup, alerting)
- Redis adapter for horizontal scaling Socket.io
- RDS/S3 migration option for higher scale
- Domain/SSL end-to-end with real DNS in production
