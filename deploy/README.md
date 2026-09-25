# Deploys to preprod

Every push to `main` that touches the backend or the web app deploys it to
**pp.remote365.ai** through the GitHub Actions workflow
`.github/workflows/deploy-preprod.yml`. Prod (remote365.ai) is not wired up; it
is still deployed by hand.

## Components

A deploy carries one or both of:

- **backend**: `auth-service`, `signaling-service`, `session-service`,
  `billing-service`, built on the droplet from source.
- **web**: the Next.js site and web app (`apps/web`), served by the `web`
  container. It is built **in GitHub Actions** (`scripts/build-web-release.sh`)
  and shipped prebuilt as `web-release/`; building its image on the droplet
  only copies files.

The workflow works out which ones the push changed and writes them to
`deploy/COMPONENTS`. A web-only push never rebuilds the API services, never
backs up the database and never runs the schema step. Changes to the shared
files (`package*.json`, `Caddyfile`, `docker-compose.prod.yml`, `deploy/`, the
workflow) ship both. A manual run ships both.

## What a deploy does

1. The workflow builds and smoke-tests the web app (if it changed), packs the
   release (the four services, `packages/shared`, the root package files,
   `Caddyfile`, `docker-compose.prod.yml`, `deploy/`, and `web-release/` for a
   web deploy) and streams the tarball over SSH to the droplet.
2. `bin/receive.sh` on the droplet (the deploy key's forced command) unpacks it
   into `/root/remote365/releases/<sha>/` and runs that release's
   `deploy/preprod-deploy.sh`.
3. The deploy script, in order:
   - **Preflight**: the database volume `remotelink-desktop_postgres_data` exists,
     postgres is healthy and mounts it, 4 GB free, `.env` present. Refuses a
     Caddyfile that proxies to `web` when there is neither a web build in the
     release nor a healthy `web` container.
   - Syncs the release into `/root/remote365/app/` (the live `.env` is kept;
     a backend-only release keeps the `web-release/` already there). Saves the
     Caddyfile caddy is serving to `/root/remote365/Caddyfile.previous`.
   - Tags the running images `:previous`, then builds the changed images one at
     a time. The old containers keep serving during the build.
   - Backend only: **backs up the database** (`pg_dump -Fc`) to
     `/root/remote365/backups/` (last 10 kept), then the **schema** step:
     dry-runs `prisma migrate diff` and prints the SQL. Purely additive changes
     (new tables, columns, enums, indexes) are applied in one transaction.
     Anything with `DROP`, `RENAME`, `ALTER COLUMN`, `TRUNCATE` or `DELETE`
     aborts the deploy before any container changes.
   - Recreates the changed services with `--no-deps`, so **postgres, redis and
     coturn are never recreated**.
   - Web: waits until the new `web` container is healthy **and** its
     `/healthz` reports this release's commit. Only then is Caddy recreated
     (when the Caddyfile changed), so traffic never reaches a web server that
     is not ready.
   - Health-checks through Caddy (`/api/auth/health`, `/api/sessions/health`,
     `/api/billing/plans`, `/api/signal`, `/`, `/login`). If it is not healthy
     within two minutes it **undoes the deploy**: previous Caddyfile, previous
     `web` image, previous backend images.
   - Post-checks: postgres container id and row counts unchanged; zero
     `Rejected unauthenticated registration` lines from signaling (the gate
     that once took the fleet offline); online-host count before/after.

Compose project name is pinned to `remotelink-desktop` in `.env` and in the
script. That name is what ties the stack to the existing volumes; using any
other name would start an empty database.

## Manual controls

In GitHub: **Actions → Deploy to preprod → Run workflow** and choose
`deploy`, `rollback` or `status`. Or on the droplet:

```bash
bash /root/remote365/app/deploy/preprod-deploy.sh status
bash /root/remote365/app/deploy/preprod-deploy.sh rollback
```

Rollback swaps the images of the components the last deploy changed back to
`:previous`; it does not undo an additive schema change (old code ignores extra
columns) or the Caddyfile.

The very first web deploy has no `:previous` web image. If it fails, the
script puts back the previous Caddyfile, which serves the old static bundle
from `/var/www/webapp` (still mounted into caddy for that reason). To do the
same by hand:

```bash
cp /root/remote365/Caddyfile.previous /root/remote365/app/Caddyfile
cd /root/remote365/app && docker compose -p remotelink-desktop -f docker-compose.prod.yml up -d --no-deps --no-build --force-recreate caddy
```

## Building the web release by hand

```bash
bash scripts/build-web-release.sh          # -> web-release/ (build on Linux to deploy it)
```

## Restoring a backup

Only if data was lost — a normal deploy never changes rows.

```bash
docker exec -i remotelink-desktop-postgres-1 pg_restore -U remotelink -d remotelink --clean --if-exists < /root/remote365/backups/<file>.dump
```

## One-time setup (already done for preprod)

`deploy/setup-preprod.sh receive.sh "<deploy public key>"` creates
`/root/remote365`, seeds `app/.env` from the live stack's `.env`, installs the
receiver and authorises the deploy key with
`restrict,command="/root/remote365/bin/receive.sh"`.

Repository secrets: `PREPROD_HOST`, `PREPROD_SSH_KEY` (private key, only used
by the workflow), `PREPROD_KNOWN_HOSTS` (the droplet's ed25519 host key line).
To rotate the key: generate a new ed25519 pair, re-run the setup script with
the new public key, update `PREPROD_SSH_KEY`, remove the old line from
`/root/.ssh/authorized_keys`.
