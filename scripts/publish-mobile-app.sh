#!/usr/bin/env bash
# Publish the Remote 365 Mobile (viewer) APK to the downloads server.
#
# Unlike the host app there is no self-update manifest — the only consumer is
# the website's Downloads page, which links the stable alias
# /downloads/mobile/Remote365-Mobile.apk. Usage:
#
#   bash scripts/publish-mobile-app.sh [preprod|prod]
#
# Reads the version from apps/remote-365-mobile/app.json, verifies the APK is
# signed with the pinned release cert, uploads to a staging name, moves into
# place, then repoints the alias LAST so the page never serves a partial file.
set -euo pipefail

TARGET="${1:-preprod}"
case "$TARGET" in
  preprod) HOST="root@206.189.127.215"; BASE_URL="https://pp.remote365.ai" ;;
  prod)    HOST="root@159.65.84.190";  BASE_URL="https://remote365.ai" ;;
  *) echo "Usage: $0 [preprod|prod]" >&2; exit 1 ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/remote-365-mobile"
APK="$APP_DIR/android/app/build/outputs/apk/release/app-release.apk"
REMOTE_DIR="/var/www/downloads/mobile"
ALIAS="Remote365-Mobile.apk"

[ -f "$APK" ] || { echo "No APK at $APK — build it first:"; echo "  cd apps/remote-365-mobile/android && ./gradlew.bat assembleRelease"; exit 1; }

# Read via a relative path from inside the app dir: on Windows/Git-Bash the
# absolute form is a /d/... MSYS path that Windows node cannot resolve.
VERSION="$(cd "$APP_DIR" && node -p "require('./app.json').expo.version")"
SIZE="$(stat -c%s "$APK")"
SHA256="$(sha256sum "$APK" | awk '{print tolower($1)}')"
APK_NAME="remote365-mobile-${VERSION}.apk"
EXPECTED_CERT_SHA256="${REMOTE365_RELEASE_CERT_SHA256:-}"

[ -n "$EXPECTED_CERT_SHA256" ] || {
  echo "REMOTE365_RELEASE_CERT_SHA256 is required; refusing to publish an unpinned APK signer." >&2
  exit 1
}

if [ -n "${APKSIGNER:-}" ]; then
  APKSIGNER_BIN="$APKSIGNER"
else
  SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  [ -n "$SDK_ROOT" ] || { echo "Set ANDROID_HOME/ANDROID_SDK_ROOT or APKSIGNER." >&2; exit 1; }
  APKSIGNER_BIN="$(find "$SDK_ROOT/build-tools" -maxdepth 2 -type f \( -name apksigner -o -name apksigner.bat \) | sort -V | tail -1)"
fi
[ -x "$APKSIGNER_BIN" ] || [ -f "$APKSIGNER_BIN" ] || { echo "apksigner not found." >&2; exit 1; }

SIGNER_OUTPUT="$("$APKSIGNER_BIN" verify --print-certs "$APK")"
ACTUAL_CERT_SHA256="$(printf '%s\n' "$SIGNER_OUTPUT" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | tr -d '\r: ' | tr '[:upper:]' '[:lower:]')"
EXPECTED_CERT_SHA256="$(printf '%s' "$EXPECTED_CERT_SHA256" | tr -d '\r: ' | tr '[:upper:]' '[:lower:]')"
[ "$ACTUAL_CERT_SHA256" = "$EXPECTED_CERT_SHA256" ] || {
  echo "APK signer mismatch; refusing publication." >&2
  echo "Expected: $EXPECTED_CERT_SHA256" >&2
  echo "Actual:   $ACTUAL_CERT_SHA256" >&2
  exit 1
}

# Identity check: a monorepo-misrooted bundler once shipped the HOST app's JS
# inside this APK (crashed on the missing ExpoSecureStore native module).
# 'remote365_language' is the viewer's i18n storage key; the latest.json path
# literal only exists in the host's self-updater.
# grep -c (not -q): -q quits at the first match, unzip dies on EPIPE, and
# pipefail turns a successful match into a pipeline failure.
VIEWER_MARKS="$(unzip -p "$APK" assets/index.android.bundle | grep -ac "remote365_language" || true)"
[ "${VIEWER_MARKS:-0}" -ge 1 ] || {
  echo "APK bundle is missing the viewer marker — wrong app bundled? Refusing." >&2
  exit 1
}
HOST_MARKS="$(unzip -p "$APK" assets/index.android.bundle | grep -ac "downloads/mobile/latest.json" || true)"
[ "${HOST_MARKS:-0}" -eq 0 ] || {
  echo "APK bundle contains the HOST app's updater — wrong app bundled. Refusing." >&2
  exit 1
}

# The APK embeds its backend at bundle time (EXPO_PUBLIC_API_BASE_URL); refuse
# to ship a build whose Hermes bundle points at the other environment.
BUNDLE_HOSTS="$(unzip -p "$APK" assets/index.android.bundle | grep -ao 'https://[a-z.]*remote365\.ai' | sort -u || true)"
# ALLOW_FLAVOR_MISMATCH=1 is a deliberate, visible opt-out — currently used to
# serve the preprod-backed build from the prod download page while prod's
# auth-service lags (no org groups, no in_session). It must never be set
# "just to make the script pass": it means real users get the testing backend.
if [ "${ALLOW_FLAVOR_MISMATCH:-0}" = "1" ]; then
  echo "!! ALLOW_FLAVOR_MISMATCH=1 — publishing a bundle that targets: $BUNDLE_HOSTS" >&2
  echo "!! Users downloading from '$TARGET' will talk to the host above." >&2
else
  case "$TARGET" in
    prod)    echo "$BUNDLE_HOSTS" | grep -q 'https://pp\.remote365\.ai' && { echo "APK bundle points at PREPROD; rebuild with EXPO_PUBLIC_API_BASE_URL=https://remote365.ai (or set ALLOW_FLAVOR_MISMATCH=1 if that is intended)" >&2; exit 1; } ;;
    preprod) echo "$BUNDLE_HOSTS" | grep -q 'https://pp\.remote365\.ai' || { echo "APK bundle does not point at preprod; rebuild with EXPO_PUBLIC_API_BASE_URL=https://pp.remote365.ai" >&2; exit 1; } ;;
  esac
fi

echo "Publishing Remote 365 Mobile $VERSION ($SIZE bytes, SHA-256 $SHA256) to $TARGET"

ssh -o BatchMode=yes "$HOST" "mkdir -p '$REMOTE_DIR'"
scp -o ConnectTimeout=20 "$APK" "$HOST:$REMOTE_DIR/.staging-$APK_NAME"
ssh -o BatchMode=yes "$HOST" "mv -f '$REMOTE_DIR/.staging-$APK_NAME' '$REMOTE_DIR/$APK_NAME'"

REMOTE_SIZE="$(ssh -o BatchMode=yes "$HOST" "stat -c%s '$REMOTE_DIR/$APK_NAME'")"
[ "$REMOTE_SIZE" = "$SIZE" ] || { echo "Size mismatch: local $SIZE vs remote $REMOTE_SIZE" >&2; exit 1; }
REMOTE_SHA256="$(ssh -o BatchMode=yes "$HOST" "sha256sum '$REMOTE_DIR/$APK_NAME' | awk '{print tolower(\$1)}'")"
[ "$REMOTE_SHA256" = "$SHA256" ] || { echo "SHA-256 mismatch after upload." >&2; exit 1; }
echo "APK verified on server ($REMOTE_SIZE bytes, SHA-256 $REMOTE_SHA256)"

# Alias last — this is the URL the Downloads page links.
ssh -o BatchMode=yes "$HOST" "ln -sfn '$APK_NAME' '$REMOTE_DIR/$ALIAS'"

echo "Published. Verify:"
echo "  curl -sI $BASE_URL/downloads/mobile/$ALIAS"
curl -sI "$BASE_URL/downloads/mobile/$ALIAS" | head -5 || true
