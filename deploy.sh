#!/bin/bash
set -Eeuo pipefail

PROJECT_DIR="/www/wwwroot/memduck"
BRANCH="${BRANCH:-main}"
APP_NAME="memduck"
PM2_CONFIG="$PROJECT_DIR/ecosystem.config.cjs"
LOG_FILE="$PROJECT_DIR/deploy.log"
NODE_BIN_DIR="/www/server/nodejs/v24.14.1/bin"

mkdir -p "$(dirname "$LOG_FILE")"
exec >>"$LOG_FILE" 2>&1

echo "==== $(date -Is) deploy start ===="
export PATH="$NODE_BIN_DIR:/www/server/panel/pyenv/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "$PROJECT_DIR"

echo "git=$(command -v git || true)"
echo "node=$(command -v node || true)"
echo "pnpm=$(command -v pnpm || true)"
echo "pm2=$(command -v pm2 || true)"

test -f package.json
test -f pnpm-lock.yaml

git fetch origin "$BRANCH"
git checkout -f "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd \
  -e .env \
  -e .env.local \
  -e .env.production \
  -e .memduck/ \
  -e deploy.log \
  -e .well-known/ \
  -e .htaccess

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 stop "$APP_NAME"
fi

pnpm install --frozen-lockfile
pnpm build
test -f "$PROJECT_DIR/.next/BUILD_ID"

pm2 startOrReload "$PM2_CONFIG" --env production
pm2 save

echo "==== $(date -Is) deploy complete ===="
