#!/usr/bin/env bash
# Builds apps/web (Next.js, standalone output) and assembles web-release/, the
# Docker build context of the `web` service:
#
#   web-release/Dockerfile   copy of apps/web/Dockerfile.runtime
#   web-release/BUILD_SHA    commit the server was built from
#   web-release/app/         standalone server: node_modules, apps/web/server.js,
#                            apps/web/.next/static, apps/web/public
#
#   bash scripts/build-web-release.sh [sha]      (default: git HEAD)
#
# Used by .github/workflows/deploy-preprod.yml and by hand for local tests.
# Build on Linux for a deployable release: node_modules carries native
# binaries (sharp) for the platform it was built on.
set -euo pipefail
cd "$(dirname "$0")/.."

SHA=${1:-$(git rev-parse HEAD 2>/dev/null || echo dev)}
OUT=web-release
STANDALONE=apps/web/.next/standalone

echo "Building apps/web at $SHA"
rm -rf apps/web/.next
(cd apps/web && BUILD_SHA="$SHA" NEXT_TELEMETRY_DISABLED=1 npx next build)

[ -f "$STANDALONE/apps/web/server.js" ] || { echo "standalone server.js not found under $STANDALONE"; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/app"
cp -R "$STANDALONE/." "$OUT/app/"
# `next build` leaves static assets and public/ out of the standalone folder;
# the server expects them next to it.
mkdir -p "$OUT/app/apps/web/.next"
cp -R apps/web/.next/static "$OUT/app/apps/web/.next/static"
cp -R apps/web/public "$OUT/app/apps/web/public"
# Dev-only settings must never reach the image.
find "$OUT/app" -maxdepth 3 -name '.env*' -type f -delete
# sharp ships builds for every Linux libc plus a wasm fallback; the runtime
# image is Debian (glibc), so the musl and wasm builds (~27 MB) are dead weight.
rm -rf "$OUT"/app/node_modules/@img/sharp-*linuxmusl* "$OUT"/app/node_modules/@img/sharp-wasm32
cp apps/web/Dockerfile.runtime "$OUT/Dockerfile"
printf '%s\n' "$SHA" > "$OUT/BUILD_SHA"

echo "web-release ready: $(du -sh "$OUT" | cut -f1), $(find "$OUT" -type f | wc -l) files"
