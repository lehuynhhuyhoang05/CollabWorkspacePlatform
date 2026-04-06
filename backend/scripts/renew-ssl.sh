#!/usr/bin/env sh
set -eu

echo "[ssl] Running certbot renew"
docker compose -f docker-compose.prod.yml run --rm certbot renew --webroot -w /var/www/certbot

echo "[ssl] Reloading nginx"
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload

echo "[ssl] Renewal run complete"
