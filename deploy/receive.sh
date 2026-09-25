#!/usr/bin/env bash
# Forced command for the GitHub Actions deploy key. sshd runs this instead of
# whatever the client asked for, and puts the client's request in
# SSH_ORIGINAL_COMMAND; only the three forms below are honoured, so the key
# cannot open a shell or run anything else on the box.
#
#   deploy <full-sha>   stdin = gzip'd tar of the backend tree (packed by the workflow)
#   rollback            previous service images
#   status              report only
#
# Installed at /root/remote365/bin/receive.sh by deploy/setup-preprod.sh.
set -euo pipefail

ROOT=/root/remote365
mkdir -p "$ROOT/releases" "$ROOT/logs"
LOG=$ROOT/logs/$(date +%Y%m%d-%H%M%S).log
cmd=${SSH_ORIGINAL_COMMAND:-}
# The deployed release's script, or the copy the setup installed before the
# first release existed.
SCRIPT=$ROOT/app/deploy/preprod-deploy.sh
[ -f "$SCRIPT" ] || SCRIPT=$ROOT/bin/preprod-deploy.sh

case "$cmd" in
  deploy\ *)
    sha=${cmd#deploy }
    [[ $sha =~ ^[0-9a-f]{40}$ ]] || { echo "refused: bad sha"; exit 2; }
    rel=$ROOT/releases/$sha
    rm -rf "$rel.tmp"; mkdir -p "$rel.tmp"
    tar -xzf - -C "$rel.tmp"
    [ -f "$rel.tmp/deploy/preprod-deploy.sh" ] || { echo "refused: tarball has no deploy/preprod-deploy.sh"; rm -rf "$rel.tmp"; exit 2; }
    rm -rf "$rel"; mv "$rel.tmp" "$rel"
    bash "$rel/deploy/preprod-deploy.sh" deploy "$sha" 2>&1 | tee "$LOG"
    ;;
  rollback)
    bash "$SCRIPT" rollback 2>&1 | tee "$LOG"
    ;;
  status)
    bash "$SCRIPT" status
    ;;
  *)
    echo "refused: unknown command '${cmd:-<none>}'"
    exit 2
    ;;
esac
