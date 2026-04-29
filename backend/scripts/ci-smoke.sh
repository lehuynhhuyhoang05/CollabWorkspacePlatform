#!/usr/bin/env sh
set -eu

# Simple CI/CD smoke checks for deployed services.
# Requirements: curl
# Usage examples:
#   API_BASE_URL=https://api.example.com ./scripts/ci-smoke.sh
#   API_BASE_URL=https://api.example.com/api/v1 ./scripts/ci-smoke.sh
#   API_HEALTH_URL=https://api.example.com/health ./scripts/ci-smoke.sh
#   FRONTEND_URL=https://example.com ./scripts/ci-smoke.sh
#   SKIP_FRONTEND_CHECK=1 ./scripts/ci-smoke.sh

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_HEALTH_URL="${API_HEALTH_URL:-}"
FRONTEND_URL="${FRONTEND_URL:-}"
SKIP_FRONTEND_CHECK="${SKIP_FRONTEND_CHECK:-0}"
RETRY_COUNT="${RETRY_COUNT:-10}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-3}"
CURL_MAX_TIME="${CURL_MAX_TIME:-10}"
CURL_INSECURE="${CURL_INSECURE:-0}"

# Derive base root from API_BASE_URL (strip trailing /api/v1 if present).
base="${API_BASE_URL%/}"
case "$base" in
  */api/v1) base="${base%/api/v1}" ;;
esac

if [ -z "$API_HEALTH_URL" ]; then
  API_HEALTH_URL="${base}/health"
fi

if [ -z "$FRONTEND_URL" ] && [ "$SKIP_FRONTEND_CHECK" != "1" ]; then
  FRONTEND_URL="$base"
fi

curl_flags="-fsS --max-time ${CURL_MAX_TIME}"
if [ "$CURL_INSECURE" = "1" ]; then
  curl_flags="${curl_flags} -k"
fi

check_url() {
  name="$1"
  url="$2"
  i=1
  while [ "$i" -le "$RETRY_COUNT" ]; do
    if curl ${curl_flags} "$url" > /dev/null 2>&1; then
      echo "[ok] ${name}: ${url}"
      return 0
    fi
    echo "[warn] ${name} failed (attempt ${i}/${RETRY_COUNT}): ${url}"
    i=$((i + 1))
    sleep "$RETRY_DELAY_SECONDS"
  done
  echo "[error] ${name} failed after ${RETRY_COUNT} attempts: ${url}"
  return 1
}

echo "[info] API_BASE_URL=${API_BASE_URL}"
echo "[info] API_HEALTH_URL=${API_HEALTH_URL}"
check_url "api-health" "$API_HEALTH_URL"

if [ "$SKIP_FRONTEND_CHECK" != "1" ]; then
  echo "[info] FRONTEND_URL=${FRONTEND_URL}"
  check_url "frontend-root" "$FRONTEND_URL"
fi

echo "[ok] CI/CD smoke checks complete"
