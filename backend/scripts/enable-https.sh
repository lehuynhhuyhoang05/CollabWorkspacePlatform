#!/usr/bin/env sh
set -eu

DOMAIN="${DOMAIN:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [ -z "$DOMAIN" ] || [ -z "$CERTBOT_EMAIL" ]; then
  echo "DOMAIN and CERTBOT_EMAIL are required"
  exit 1
fi

echo "[ssl] Bootstrapping HTTP config for ACME challenge"
cp nginx/http.conf nginx/active.conf

echo "[ssl] Starting full stack"
docker compose -f docker-compose.prod.yml up -d

echo "[ssl] Requesting certificate for $DOMAIN"
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

echo "[ssl] Switching nginx to HTTPS config"
sed "s/\${DOMAIN}/$DOMAIN/g" nginx/https.conf > nginx/active.conf

docker compose -f docker-compose.prod.yml up -d nginx

echo "[ssl] HTTPS enabled for $DOMAIN"
