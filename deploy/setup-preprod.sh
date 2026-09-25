#!/usr/bin/env bash
# One-time setup on the preprod droplet, run as root:
#
#   bash setup-preprod.sh <dir holding receive.sh + preprod-deploy.sh> "<deploy public key line>"
#
# Creates /root/remote365, seeds app/.env from the LIVE stack's .env (not from
# /root/.env.preprod, which is older), pins the Compose project name so the
# existing database volume is reused, installs the forced-command receiver and
# authorises the GitHub Actions deploy key restricted to it.
set -euo pipefail

SRC_DIR=${1:?directory holding receive.sh and preprod-deploy.sh}
PUBKEY=${2:?deploy public key line}
ROOT=/root/remote365
LIVE_ENV=/root/RemoteLink-Desktop/.env
PROJECT=remotelink-desktop

mkdir -p "$ROOT"/{app,releases,backups,logs,bin}

if [ ! -f "$ROOT/app/.env" ]; then
  [ -f "$LIVE_ENV" ] || { echo "live env $LIVE_ENV not found"; exit 1; }
  tr -d '\r' <"$LIVE_ENV" >"$ROOT/app/.env"
  echo "seeded app/.env from $LIVE_ENV ($(grep -cE '^[A-Z_]+=' "$ROOT/app/.env") keys)"
fi
grep -q "^COMPOSE_PROJECT_NAME=" "$ROOT/app/.env" || printf '\n# Pinned: the database volume belongs to this Compose project\nCOMPOSE_PROJECT_NAME=%s\n' "$PROJECT" >>"$ROOT/app/.env"
chmod 600 "$ROOT/app/.env"

install -m 755 "$SRC_DIR/receive.sh" "$ROOT/bin/receive.sh"
# Used by `status`/`rollback` until the first release brings its own copy.
install -m 755 "$SRC_DIR/preprod-deploy.sh" "$ROOT/bin/preprod-deploy.sh"

# The key may only run the receiver: no shell, pty, forwarding or user rc.
LINE="restrict,command=\"$ROOT/bin/receive.sh\" $PUBKEY"
touch /root/.ssh/authorized_keys; chmod 600 /root/.ssh/authorized_keys
if grep -qF "$PUBKEY" /root/.ssh/authorized_keys; then
  echo "deploy key already authorised"
else
  printf '%s\n' "$LINE" >>/root/.ssh/authorized_keys
  echo "deploy key authorised (forced command only)"
fi
sshd -t && echo "sshd config OK"

docker volume inspect "${PROJECT}_postgres_data" >/dev/null && echo "database volume ${PROJECT}_postgres_data present"
which rsync flock >/dev/null || { echo "rsync/flock missing: apt-get install -y rsync util-linux"; exit 1; }
echo "setup complete"
