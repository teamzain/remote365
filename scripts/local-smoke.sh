#!/usr/bin/env bash
# Local backend smoke test: builds the production images from this checkout,
# runs them with Postgres/Redis/Caddy on this machine, creates the schema,
# seeds a test owner and runs scripts/smoke-test.cjs against
# http://localhost:8088. Touches no server.
#
#   npm run test:smoke             build, start, test (stack left running)
#   npm run test:smoke -- --down   same, then remove containers + test data
#   docker compose -p r365test down -v     remove the stack later
#
# Needs Docker (Desktop) running and Node 22+. Settings live in the git-ignored
# .env.localtest, generated with random throwaway secrets on first run.
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash on Windows: keep container paths as-is

cd "$(dirname "$0")/.."

ENV_FILE=.env.localtest
SMOKE_EMAIL=smoke-owner@test.local
SERVICES="auth-service signaling-service session-service billing-service"

if [ ! -f "$ENV_FILE" ]; then
  rand() { node -e "console.log(require('crypto').randomBytes($1).toString('hex'))"; }
  DB_PASSWORD=$(rand 12)
  cat > "$ENV_FILE" <<EOF
# Throwaway settings for scripts/local-smoke.sh only — never a real server.
DB_USER=remotelink
DB_PASSWORD=$DB_PASSWORD
DB_NAME=remotelink
DATABASE_URL=postgresql://remotelink:$DB_PASSWORD@postgres:5432/remotelink
REDIS_URL=redis://redis:6379
JWT_SECRET=$(rand 32)
DOMAIN=localhost
CADDY_SITE=:80
SERVER_IP=127.0.0.1
TURN_USER=localtest
TURN_PASSWORD=localtest
BILLING_TEST_MODE=false
SMOKE_ADMIN_PASSWORD=Smoke-$(rand 6)!
EOF
  echo "Created $ENV_FILE"
fi
SMOKE_PASSWORD=$(grep '^SMOKE_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)

DC="docker compose -p r365test --env-file $ENV_FILE -f docker-compose.prod.yml -f docker-compose.localtest.yml"

# One image at a time: parallel builds hammer the npm registry and fail with
# transient ERR_SSL_CIPHER_OPERATION_FAILED errors.
for s in $SERVICES; do
  for attempt in 1 2 3; do
    echo "Building $s (attempt $attempt)..."
    if $DC build -q "$s"; then break; fi
    [ "$attempt" = 3 ] && { echo "Build of $s failed"; exit 1; }
  done
done

$DC up -d postgres redis caddy $SERVICES

echo "Waiting for Postgres..."
for _ in $(seq 1 60); do
  $DC exec -T postgres pg_isready -U remotelink >/dev/null 2>&1 && break
  sleep 2
done

echo "Creating schema and seeding the test owner..."
$DC exec -T auth-service npx prisma db push --schema packages/shared/prisma/schema.prisma --skip-generate
$DC exec -T -e ADMIN_EMAIL="$SMOKE_EMAIL" -e ADMIN_PASSWORD="$SMOKE_PASSWORD" auth-service npm run seed -w @remotelink/shared
# The smoke test promotes this user to super admin at the end; start each run as owner.
$DC exec -T postgres psql -U remotelink -d remotelink -qc "UPDATE \"User\" SET role='OWNER' WHERE email='$SMOKE_EMAIL';"

# The services booted before the tables existed; restart them against the real schema.
$DC restart $SERVICES
echo "Waiting for the API..."
for _ in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8088/api/auth/health)" = 200 ] && break
  sleep 2
done

status=0
COMPOSE_CMD="$DC" node scripts/smoke-test.cjs "$SMOKE_EMAIL" "$SMOKE_PASSWORD" || status=$?

if [ "${1:-}" = "--down" ]; then
  $DC down -v
else
  echo "Stack left running on http://localhost:8088 — remove it with: docker compose -p r365test down -v"
fi
exit $status
