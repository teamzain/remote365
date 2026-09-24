#!/bin/bash
set -euo pipefail

PROD_HOST="${PROD_HOST:-root@159.65.84.190}"
PREPROD_HOST="${PREPROD_HOST:-root@206.189.127.215}"
APP_DIR="${APP_DIR:-/root/RemoteLink-Desktop}"
STAMP="$(date +%Y%m%d%H%M%S)"
LOCAL_TMP="${LOCAL_TMP:-./migration-$STAMP}"

mkdir -p "$LOCAL_TMP"

echo "Creating production backup on $PROD_HOST..."
ssh "$PROD_HOST" "set -euo pipefail
  TMP=/tmp/remotelink-backup-$STAMP
  mkdir -p \"\$TMP\"
  cd '$APP_DIR'
  docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U remotelink remotelink > \"\$TMP/postgres.sql\"
  docker compose -f docker-compose.prod.yml exec -T redis redis-cli SAVE || true
  REDIS_CID=\$(docker compose -f docker-compose.prod.yml ps -q redis)
  docker cp \"\$REDIS_CID:/data\" \"\$TMP/redis-data\"
  tar -C \"\$TMP\" -czf \"\$TMP/state.tgz\" postgres.sql redis-data
  cp /root/.env.production \"\$TMP/env.production.source\"
  echo \"\$TMP\"
" > "$LOCAL_TMP/prod_tmp_path.txt"

PROD_TMP="$(tail -n 1 "$LOCAL_TMP/prod_tmp_path.txt")"

scp "$PROD_HOST:$PROD_TMP/state.tgz" "$LOCAL_TMP/state.tgz"
scp "$PROD_HOST:$PROD_TMP/env.production.source" "$LOCAL_TMP/env.production.source"

echo "Syncing desktop downloads..."
rsync -az --delete "$PROD_HOST:/var/www/downloads/" "$PREPROD_HOST:/var/www/downloads/"

echo "Uploading backup to pre-prod..."
scp "$LOCAL_TMP/state.tgz" "$PREPROD_HOST:/tmp/remotelink-state.tgz"
scp "$LOCAL_TMP/env.production.source" "$PREPROD_HOST:/tmp/env.production.source"

ssh "$PREPROD_HOST" "set -euo pipefail
  mkdir -p '$APP_DIR' /var/www/downloads
  if [ ! -d '$APP_DIR/.git' ]; then
    git clone https://github.com/teamzain/RemoteLink-Desktop.git '$APP_DIR'
  fi
  cp /tmp/env.production.source /root/.env.preprod
  sed -i \
    -e 's#remote365.ai#pp.remote365.ai#g' \
    -e 's#159.65.84.190#206.189.127.215#g' \
    -e 's#^DOMAIN=.*#DOMAIN=pp.remote365.ai#' \
    -e 's#^CADDY_SITE=.*#CADDY_SITE=pp.remote365.ai, :80#' \
    -e 's#^TURN_REALM=.*#TURN_REALM=pp.remote365.ai#' \
    -e 's#^TURN_HOST=.*#TURN_HOST=pp.remote365.ai#' \
    -e 's#^DESKTOP_DOWNLOAD_URL=.*#DESKTOP_DOWNLOAD_URL=https://pp.remote365.ai/downloads/desktop/#' \
    -e 's#^GOOGLE_CALLBACK_URL=.*#GOOGLE_CALLBACK_URL=https://pp.remote365.ai/api/auth/oauth/google/callback#' \
    /root/.env.preprod
  tar -C /tmp -xzf /tmp/remotelink-state.tgz
  echo 'Pre-prod backup staged.'
"

cat <<EOF
Backup is staged on $PREPROD_HOST.

Before starting pre-prod, SSH into the server and rotate secrets in /root/.env.preprod:
  JWT_SECRET
  TURN_PASSWORD

Then run:
  cd $APP_DIR
  ./deploy.sh preprod
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U remotelink remotelink < /tmp/postgres.sql
  docker compose -f docker-compose.prod.yml restart

Caddy certificate storage was not copied; Caddy will issue a fresh certificate for pp.remote365.ai.
EOF

