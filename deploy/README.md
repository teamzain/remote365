# Backend deploys to preprod

Every push to `main` that touches the backend deploys it to **pp.remote365.ai**
through the GitHub Actions workflow `.github/workflows/deploy-preprod.yml`.
Prod (remote365.ai) is not wired up; it is still deployed by hand.

## What a deploy does

1. The workflow packs the backend files (the four services, `packages/shared`,
   the root package files, `Caddyfile`, `docker-compose.prod.yml`, `deploy/`)
   and streams the tarball over SSH to the droplet.
2. `bin/receive.sh` on the droplet (the deploy key's forced command) unpacks it
   into `/root/remote365/releases/<sha>/` and runs that release's
   `deploy/preprod-deploy.sh`.
3. The deploy script, in order:
   - **Preflight**: the database volume `remotelink-desktop_postgres_data` exists,
     postgres is healthy and mounts it, 4 GB free, `.env` present.
   - Syncs the release into `/root/remote365/app/` (the live `.env` is kept).
   - Tags the running images `:previous`, then builds the four service images
     one at a time. The old containers keep serving during the build.
   - **Backs up the database** (`pg_dump -Fc`) to `/root/remote365/backups/`
     (last 10 kept).
   - **Schema**: dry-runs `prisma migrate diff` and prints the SQL. Purely
     additive changes (new tables, columns, enums, indexes) are applied with
     `prisma db push`. Anything with `DROP`, `RENAME`, `ALTER COLUMN`,
     `TRUNCATE` or `DELETE` aborts the deploy before any container changes.
   - Recreates `auth-service`, `signaling-service`, `session-service` and
     `billing-service` with `--no-deps`, so **postgres, redis and coturn are
     never recreated**. Caddy is recreated only when the Caddyfile changed.
   - Health-checks through Caddy (`/api/auth/health`, `/api/sessions/health`,
     `/api/billing/plans`, `/api/signal`). If it is not healthy within two
     minutes it **rolls back** to the `:previous` images.
   - Post-checks: postgres container id and row counts unchanged; zero
     `Rejected unauthenticated registration` lines from signaling (the gate
     that once took the fleet offline); online-host count before/after.

Compose project name is pinned to `remotelink-desktop` in `.env` and in the
script. That name is what ties the stack to the existing volumes; using any
other name would start an empty database.

## Manual controls

In GitHub: **Actions → Deploy backend to preprod → Run workflow** and choose
`deploy`, `rollback` or `status`. Or on the droplet:

```bash
bash /root/remote365/app/deploy/preprod-deploy.sh status
bash /root/remote365/app/deploy/preprod-deploy.sh rollback
```

Rollback swaps the service images back to `:previous`; it does not undo an
additive schema change (old code ignores extra columns) or the Caddyfile.

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
