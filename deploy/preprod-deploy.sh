#!/usr/bin/env bash
# Preprod and prod deploy (the site comes from $ROOT/site.conf; see below).
# Runs ON the droplet as root, normally via bin/receive.sh (the
# forced command of the GitHub Actions deploy key), or by hand:
#
#   bash /root/remote365/app/deploy/preprod-deploy.sh deploy <full-sha>  # needs releases/<sha>/
#   bash /root/remote365/app/deploy/preprod-deploy.sh rollback           # previous images
#   bash /root/remote365/app/deploy/preprod-deploy.sh status
#
# A release carries deploy/COMPONENTS, written by the workflow: "backend", "web"
# or both. backend = the four API services; web = the Next.js site/app, shipped
# prebuilt in web-release/. A release without the file is backend-only.
#
# The database stays exactly as it is. This script reuses the existing Compose
# project so the same named volumes are used, only ever touches the backend
# services, `web`, and Caddy (when the Caddyfile changed), and runs schema
# changes only when they are purely additive. It never runs `down`, `-v`,
# `--remove-orphans`, the seed, or `db push --accept-data-loss`, and never
# copies /root/.env.preprod over the live .env.
set -euo pipefail

ROOT=/root/remote365
APP=$ROOT/app
# Must match the stack that already runs: its volumes are named
# ${PROJECT}_postgres_data etc. Any other name would start a NEW, EMPTY database.
PROJECT=remotelink-desktop
COMPOSE_FILE=docker-compose.prod.yml
BACKEND="auth-service signaling-service session-service billing-service"
WEB=web
PG_CONTAINER=${PROJECT}-postgres-1
PG_VOLUME=${PROJECT}_postgres_data
# Which site this box serves. Preprod has no site.conf and keeps these
# defaults; prod's one-time setup writes SITE=remote365.ai LABEL=prod there.
SITE=pp.remote365.ai
LABEL=preprod
# shellcheck disable=SC1091
[ -f "$ROOT/site.conf" ] && . "$ROOT/site.conf"
KEEP_BACKUPS=10
KEEP_RELEASES=5
HEALTH_TIMEOUT=120
# The Caddyfile the running caddy served before this deploy, restored if the
# deploy fails after switching it.
CADDY_PREVIOUS=$ROOT/Caddyfile.previous

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "FAILED: $*"; exit 1; }
dc() { (cd "$APP" && docker compose -p "$PROJECT" -f "$COMPOSE_FILE" "$@"); }
pg() { docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "$1"; }
has() { case " $COMPONENTS " in *" $1 "*) return 0 ;; esac; return 1; }

db_env() {
  # DATABASE_URL exactly as Compose built it for the running auth-service; used
  # for the Prisma run below so the URL never has to be re-derived from .env.
  DATABASE_URL=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "${PROJECT}-auth-service-1" | grep '^DATABASE_URL=' | cut -d= -f2-)
  [ -n "$DATABASE_URL" ] || die "could not read DATABASE_URL from the running auth-service"
  DB_USER=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$PG_CONTAINER" | grep '^POSTGRES_USER=' | cut -d= -f2-)
  DB_NAME=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$PG_CONTAINER" | grep '^POSTGRES_DB=' | cut -d= -f2-)
  [ -n "$DB_USER" ] && [ -n "$DB_NAME" ] || die "could not read POSTGRES_USER/POSTGRES_DB from $PG_CONTAINER"
}

db_fingerprint() {
  pg 'select count(*) from "User"' | tr -d '[:space:]'; printf ' users, '
  pg 'select count(*) from "Device"' | tr -d '[:space:]'; printf ' devices, '
  pg 'select count(*) from "Subscription"' | tr -d '[:space:]'; printf ' subscriptions\n'
}

presence_count() {
  docker exec "${PROJECT}-redis-1" redis-cli --scan --pattern 'presence:*' 2>/dev/null | wc -l | tr -d '[:space:]'
}

preflight() {
  log "Preflight"
  exec 9>"$ROOT/deploy.lock"
  flock -n 9 || die "another deploy is running"
  [ -f "$APP/.env" ] || die "$APP/.env is missing (run deploy/setup-preprod.sh once)"
  grep -q "^COMPOSE_PROJECT_NAME=$PROJECT$" "$APP/.env" || die ".env must pin COMPOSE_PROJECT_NAME=$PROJECT"
  docker volume inspect "$PG_VOLUME" >/dev/null 2>&1 || die "database volume $PG_VOLUME not found"
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$PG_CONTAINER" 2>/dev/null)" = healthy ] || die "$PG_CONTAINER is not healthy"
  docker inspect -f '{{range .Mounts}}{{.Name}} {{end}}' "$PG_CONTAINER" | grep -qw "$PG_VOLUME" || die "$PG_CONTAINER does not mount $PG_VOLUME"
  PG_ID_BEFORE=$(docker inspect -f '{{.Id}}' "$PG_CONTAINER")
  local avail_gb; avail_gb=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
  [ "$avail_gb" -ge 4 ] || die "only ${avail_gb}G free on /, need 4G"
  db_env
  DB_BEFORE=$(db_fingerprint)
  PRESENCE_BEFORE=$(presence_count)
  log "Database: $DB_BEFORE; online hosts (presence keys): $PRESENCE_BEFORE"
}

web_running() {
  [ "$(docker inspect -f '{{.State.Health.Status}}' "${PROJECT}-${WEB}-1" 2>/dev/null)" = healthy ]
}

sync_release() {
  local rel=$ROOT/releases/$1
  [ -d "$rel" ] || die "release dir $rel not found"
  [ -f "$rel/$COMPOSE_FILE" ] && [ -f "$rel/Caddyfile" ] || die "release is missing $COMPOSE_FILE or Caddyfile"
  COMPONENTS=backend
  [ -f "$rel/deploy/COMPONENTS" ] && COMPONENTS=$(tr -s '[:space:]' ' ' <"$rel/deploy/COMPONENTS")
  COMPONENTS=" ${COMPONENTS# } "
  has backend || has "$WEB" || die "deploy/COMPONENTS names nothing to deploy: '$COMPONENTS'"
  if has "$WEB"; then
    [ -f "$rel/web-release/Dockerfile" ] && [ -s "$rel/web-release/BUILD_SHA" ] || die "COMPONENTS includes web but the release has no web-release/"
  fi
  # A Caddyfile that sends the site to `web` needs a web container that is
  # either part of this release or already serving.
  if grep -q "reverse_proxy $WEB:3000" "$rel/Caddyfile" && ! has "$WEB" && ! web_running; then
    die "the Caddyfile proxies to $WEB but this release has no web build and no $WEB container is running"
  fi
  # Compare against the file the RUNNING caddy container actually mounts: a
  # bind mount keeps the path it was created with, so a container from the
  # old checkout keeps serving that copy even after app/Caddyfile is updated.
  local mounted
  mounted=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}' "${PROJECT}-caddy-1" 2>/dev/null || true)
  CADDY_CHANGED=1
  if [ "$mounted" = "$APP/Caddyfile" ] && [ -f "$mounted" ] && cmp -s "$rel/Caddyfile" "$mounted"; then
    CADDY_CHANGED=0
  fi
  rm -f "$CADDY_PREVIOUS"
  if [ "$CADDY_CHANGED" = 1 ] && [ -f "$mounted" ]; then
    cp "$mounted" "$CADDY_PREVIOUS"
  fi
  # .env is the only file in app/ that is not part of a release; keep it. A
  # backend-only release has no web-release/: keep the one in place (excluded
  # paths are never deleted by --delete).
  local keep_web=()
  has "$WEB" || keep_web=(--exclude /web-release)
  rsync -a --delete --exclude '.env' "${keep_web[@]}" "$rel/" "$APP/"
  dc config -q || die "docker compose config rejected the release"
  log "Release $1 in place (components:$COMPONENTS; Caddyfile changed: $CADDY_CHANGED)"
}

tag_previous() {
  # Tag what is actually RUNNING, not :latest — after an aborted deploy
  # :latest is the unused new build, and rolling back to it would be a no-op.
  for s in "$@"; do
    local img=${PROJECT}-${s} running
    running=$(docker inspect -f '{{.Image}}' "${PROJECT}-${s}-1" 2>/dev/null || true)
    if [ -n "$running" ]; then
      docker tag "$running" "$img:previous"
    elif docker image inspect "$img:latest" >/dev/null 2>&1; then
      docker tag "$img:latest" "$img:previous"
    fi
  done
  log "Running images tagged :previous for rollback: $*"
}

build_images() {
  # One service at a time: parallel builds on this 4 GB box hit the npm registry
  # hard enough to fail with ERR_SSL_CIPHER_OPERATION_FAILED. The old
  # containers keep serving while this runs.
  mkdir -p "$ROOT/logs"
  for s in "$@"; do
    local ok=0 blog="$ROOT/logs/build-${SHA:0:7}-$s.log"
    for attempt in 1 2 3; do
      log "Building $s (attempt $attempt)"
      if BUILDKIT_PROGRESS=plain dc build "$s" >"$blog" 2>&1; then ok=1; break; fi
      tail -n 15 "$blog"
    done
    [ "$ok" = 1 ] || die "build of $s failed, see $blog"
  done
}

backup_db() {
  mkdir -p "$ROOT/backups"
  BACKUP="$ROOT/backups/${LABEL}-$(date +%Y%m%d-%H%M%S)-${SHA:0:7}.dump"
  docker exec "$PG_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc >"$BACKUP"
  [ -s "$BACKUP" ] || die "backup file is empty"
  docker exec -i "$PG_CONTAINER" pg_restore -l <"$BACKUP" >/dev/null || die "backup does not verify"
  log "Database backed up to $BACKUP ($(du -h "$BACKUP" | cut -f1))"
  prune_old "$ROOT/backups" '*.dump' "$KEEP_BACKUPS"
}

# Delete all but the newest N entries matching a glob. Tolerates no matches
# (a bare `ls glob | ...` exits non-zero under pipefail and would abort).
prune_old() {
  local dir=$1 glob=$2 keep=$3
  find "$dir" -maxdepth 1 -name "$glob" -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | tail -n +$((keep + 1)) | cut -d' ' -f2- | xargs -r rm -rf
}

prisma() {
  # Runs the NEW image's Prisma CLI against the live database, before the new
  # code starts. Only DATABASE_URL is needed, taken from the running service.
  docker run --rm --network "${PROJECT}_default" -e DATABASE_URL="$DATABASE_URL" \
    "${PROJECT}-auth-service:latest" ./node_modules/.bin/prisma "$@"
}

sync_schema() {
  local schema=packages/shared/prisma/schema.prisma
  log "Schema check (dry run)"
  local sql
  sql=$(prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel "$schema" --script 2>/dev/null) \
    || die "prisma migrate diff failed"
  if printf '%s' "$sql" | grep -q 'empty migration'; then
    log "Schema already up to date"
    return
  fi
  printf '%s\n' "$sql"
  if printf '%s' "$sql" | grep -Eiq '\b(DROP|RENAME|ALTER COLUMN|TRUNCATE|DELETE)\b'; then
    die "schema change is not purely additive — apply it by hand, then redeploy"
  fi
  # Apply exactly the SQL inspected above, in ONE transaction: if any statement
  # fails (say a unique index over existing duplicates) Postgres rolls the
  # whole change back and the deploy stops before any container changes.
  # (`prisma db push` is not used: it refuses every new unique index without
  # --accept-data-loss, and that flag would also wave through real data loss.)
  log "Applying additive schema change in a single transaction"
  printf '%s\n' "$sql" | docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -1 -q \
    || die "schema change failed and was rolled back"
  sql=$(prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel "$schema" --script 2>/dev/null)
  printf '%s' "$sql" | grep -q 'empty migration' || die "schema still differs after applying the change"
}

web_sha() {
  docker exec "${PROJECT}-${WEB}-1" node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>r.json()).then(j=>console.log(j.sha),()=>{})" 2>/dev/null || true
}

# The new web container must be healthy and report the release's commit
# BEFORE Caddy sends traffic to it.
wait_web() {
  local want waited=0
  want=$(tr -d '[:space:]' <"$APP/web-release/BUILD_SHA")
  until web_running && [ "$(web_sha)" = "$want" ]; do
    [ "$waited" -ge 90 ] && { docker logs --tail 30 "${PROJECT}-${WEB}-1" 2>&1 || true; return 1; }
    sleep 3; waited=$((waited + 3))
  done
  log "$WEB healthy on $want after ${waited}s"
}

recreate_caddy() {
  log "Caddyfile changed: recreating caddy"
  dc up -d --no-deps --no-build --force-recreate caddy
}

http_code() { curl -sS -o /dev/null -w '%{http_code}' -m 8 --resolve "$SITE:443:127.0.0.1" "https://$SITE$1" 2>/dev/null || echo 000; }

healthy() {
  [ "$(http_code /api/auth/health)" = 200 ] || return 1
  [ "$(http_code /api/sessions/health)" = 200 ] || return 1
  [ "$(http_code /api/billing/plans)" = 200 ] || return 1
  # The signaling WebSocket answers a plain GET with an "upgrade required"
  # style status; a gateway error means it is down.
  case "$(http_code /api/signal)" in 000|502|503|504) return 1 ;; esac
  # The site and the app shell, whoever serves them.
  [ "$(http_code /)" = 200 ] || return 1
  [ "$(http_code /login)" = 200 ] || return 1
  for s in $BACKEND; do
    [ "$(docker inspect -f '{{.State.Status}}' "${PROJECT}-${s}-1" 2>/dev/null)" = running ] || return 1
  done
}

wait_healthy() {
  local waited=0
  until healthy; do
    [ "$waited" -ge "$HEALTH_TIMEOUT" ] && return 1
    sleep 5; waited=$((waited + 5))
  done
  log "Healthy through Caddy after ${waited}s"
}

post_checks() {
  local pg_id_now; pg_id_now=$(docker inspect -f '{{.Id}}' "$PG_CONTAINER")
  [ "$pg_id_now" = "$PG_ID_BEFORE" ] || die "postgres container was recreated — investigate before anything else"
  local db_after; db_after=$(db_fingerprint)
  [ "$db_after" = "$DB_BEFORE" ] || die "row counts changed during deploy: before [$DB_BEFORE] after [$db_after]"
  log "Database unchanged: $db_after"

  # The signaling gate: this string exists only in the hardened
  # canRegisterHost that once took the whole fleet offline. One hit = roll back.
  local rejected
  rejected=$(docker logs --since "$START_TS" "${PROJECT}-signaling-service-1" 2>&1 | grep -c 'Rejected unauthenticated registration' || true)
  [ "$rejected" = 0 ] || { log "signaling rejected $rejected host registrations since deploy"; return 1; }

  sleep 20
  local presence_after; presence_after=$(presence_count)
  log "Online hosts: $PRESENCE_BEFORE before, $presence_after 20s after (hosts reconnect over a minute or two)"
  local cred
  cred=$(docker logs --since "$START_TS" "${PROJECT}-auth-service-1" 2>&1 | grep -cE 'Invalid host credential|Host credential enrollment requires' || true)
  [ "$cred" = 0 ] || log "WARNING: $cred Android host-credential rejections since deploy — check auth-service logs"
}

cleanup() {
  printf '%s\n' "$SHA" >"$ROOT/current-sha"
  printf '%s\n' "$COMPONENTS" >"$ROOT/current-components"
  prune_old "$ROOT/releases" '[0-9a-f]*' "$KEEP_RELEASES"
  docker image prune -f >/dev/null 2>&1 || true
  # Keep the npm-install layers (they make builds fast and reliable) but stop
  # the build cache growing without bound. Flag name depends on the version.
  docker builder prune -f --max-used-space 20GB >/dev/null 2>&1 \
    || docker builder prune -f --keep-storage 20GB >/dev/null 2>&1 || true
}

# Undo whatever this deploy changed, newest first.
undo_deploy() {
  if [ "${CADDY_CHANGED:-0}" = 1 ] && [ "${CADDY_SWITCHED:-0}" = 1 ] && [ -f "$CADDY_PREVIOUS" ]; then
    log "Restoring the previous Caddyfile"
    cp "$CADDY_PREVIOUS" "$APP/Caddyfile"
    recreate_caddy
  fi
  if has "$WEB" && [ "${WEB_STARTED:-0}" = 1 ]; then rollback_web; fi
  if has backend && [ "${BACKEND_STARTED:-0}" = 1 ]; then rollback_images; fi
  wait_healthy && log "Healthy again after undo" || log "WARNING: still unhealthy after undo"
}

deploy() {
  SHA=$1
  START_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  log "Deploying $SHA to $SITE"
  preflight
  sync_release "$SHA"
  local targets=()
  # shellcheck disable=SC2206 # the service list is meant to split
  has backend && targets+=($BACKEND)
  has "$WEB" && targets+=("$WEB")
  tag_previous "${targets[@]}"
  build_images "${targets[@]}"
  if has backend; then
    backup_db
    sync_schema
    log "Recreating: $BACKEND"
    # --no-deps: postgres, redis and coturn are never recreated by a deploy.
    dc up -d --no-deps --no-build $BACKEND
    BACKEND_STARTED=1
  fi
  if has "$WEB"; then
    log "Recreating: $WEB"
    dc up -d --no-deps --no-build "$WEB"
    WEB_STARTED=1
    if ! wait_web; then
      log "$WEB did not come up on the new build — undoing"
      undo_deploy
      die "deploy of $SHA rolled back ($WEB unhealthy; database untouched${BACKUP:+, backup at $BACKUP})"
    fi
  fi
  if [ "$CADDY_CHANGED" = 1 ]; then
    recreate_caddy
    CADDY_SWITCHED=1
  fi
  if ! wait_healthy; then
    log "Health check failed — undoing"
    dc ps
    undo_deploy
    die "deploy of $SHA rolled back (database untouched${BACKUP:+, backup at $BACKUP})"
  fi
  if ! post_checks; then
    undo_deploy
    die "post-deploy checks failed; rolled back (database untouched${BACKUP:+, backup at $BACKUP})"
  fi
  cleanup
  log "DEPLOY OK $SHA"
}

rollback_images() {
  for s in $BACKEND; do
    local img=${PROJECT}-${s}
    docker image inspect "$img:previous" >/dev/null 2>&1 || die "no :previous image for $s"
    docker tag "$img:previous" "$img:latest"
  done
  dc up -d --no-deps --no-build --force-recreate $BACKEND
  log "Backend services back on :previous images"
}

rollback_web() {
  local img=${PROJECT}-${WEB}
  if ! docker image inspect "$img:previous" >/dev/null 2>&1; then
    # First web deploy: nothing older to go back to. Undoing the Caddyfile
    # (above) already put the site back on the static bundle.
    log "No :previous $WEB image (first web deploy); leaving it"
    return 0
  fi
  docker tag "$img:previous" "$img:latest"
  dc up -d --no-deps --no-build --force-recreate "$WEB"
  log "$WEB back on its :previous image"
}

rollback() {
  exec 9>"$ROOT/deploy.lock"; flock -n 9 || die "another deploy is running"
  db_env
  COMPONENTS=" $(cat "$ROOT/current-components" 2>/dev/null || echo backend) "
  log "Rolling back $(cat "$ROOT/current-sha" 2>/dev/null || echo '?') ($COMPONENTS) to the previous images"
  log "Note: app files and Caddyfile stay at the current release; only images change"
  has backend && rollback_images
  has "$WEB" && rollback_web
  wait_healthy && log "Rolled back" || log "WARNING: still unhealthy after rollback"
}

status() {
  # Works before the first release too, so it doubles as the pipeline's
  # connectivity test; hence no dependence on app/docker-compose.prod.yml.
  db_env
  echo "current sha:  $(cat "$ROOT/current-sha" 2>/dev/null || echo 'none (nothing deployed through this pipeline yet)')"
  echo "components:   $(cat "$ROOT/current-components" 2>/dev/null || echo 'backend')"
  echo "database:     $(db_fingerprint)"
  echo "online hosts: $(presence_count)"
  echo "web build:    $(web_sha | grep . || echo 'no web container')"
  echo "last backup:  $(ls -1t "$ROOT"/backups/*.dump 2>/dev/null | head -1 || echo none)"
  echo "images:"
  docker images --format '  {{.Repository}}:{{.Tag}}  {{.CreatedSince}}' | grep "${PROJECT}-" | sort
  echo "containers:"
  docker ps -a --filter "label=com.docker.compose.project=$PROJECT" --format '  {{.Names}}  {{.Status}}'
}

case "${1:-}" in
  deploy) [[ ${2:-} =~ ^[0-9a-f]{40}$ ]] || die "usage: deploy <full-sha>"; deploy "$2" ;;
  rollback) rollback ;;
  status) status ;;
  *) echo "usage: $0 deploy <sha> | rollback | status"; exit 2 ;;
esac
