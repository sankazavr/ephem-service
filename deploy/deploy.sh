#!/usr/bin/env bash
# Выкладка на сервер. На сервере всегда работает ровно тот код, что опубликован в репозитории (AGPL, раздел 13).
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${DEPLOY_HOST:-xorek2}"
DIR="${DEPLOY_DIR:-/opt/ephem-service}"

if [ -n "$(git status --porcelain)" ]; then
  echo "Есть незакоммиченные правки — сначала commit и push." >&2; exit 1
fi
git fetch --quiet origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "HEAD не совпадает с origin/main — сначала git push (код на сервере должен быть опубликован)." >&2; exit 1
fi

SHA="$(git rev-parse --short HEAD)"
echo "Выкладываю $SHA на $HOST:$DIR"
ssh "$HOST" "mkdir -p '$DIR' && find '$DIR' -mindepth 1 -maxdepth 1 ! -name deploy -exec rm -rf {} + && find '$DIR/deploy' -mindepth 1 ! -name .env -exec rm -rf {} + 2>/dev/null || true"
git archive --format=tar HEAD | ssh "$HOST" "tar -x -C '$DIR'"
ssh "$HOST" "cd '$DIR/deploy' && test -f .env && GIT_SHA=$SHA docker compose up -d --build && docker image prune -f >/dev/null"
sleep 5
ssh "$HOST" "curl -fsS http://127.0.0.1:8095/v1/health"; echo
