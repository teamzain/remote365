#!/usr/bin/env bash
# Publish an Android host APK so existing installs can self-update.
#
# The mobile host has no store presence and lives on unattended, often remote
# devices, so this is the only path a fix has to reach them. Usage:
#
#   bash scripts/publish-mobile-host.sh [preprod|prod]
#
# Reads the version from apps/mobile-native-host/app.json, uploads the release
# APK, then writes latest.json LAST so a client can never see a manifest that
# points at a half-uploaded file.
set -euo pipefail

TARGET="${1:-preprod}"
case "$TARGET" in
  preprod) HOST="root@206.189.127.215"; BASE_URL="https://pp.remote365.ai" ;;
  prod)    HOST="root@159.65.84.190";  BASE_URL="https://remote365.ai" ;;
  *) echo "Usage: $0 [preprod|prod]" >&2; exit 1 ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/mobile-native-host"
APK="$APP_DIR/android/app/build/outputs/apk/release/app-release.apk"
REMOTE_DIR="/var/www/downloads/mobile"

[ -f "$APK" ] || { echo "No APK at $APK — build it first:"; echo "  cd apps/mobile-native-host/android && ./gradlew.bat assembleRelease"; exit 1; }

# Read via a relative path from inside the app dir: on Windows/Git-Bash the
# absolute form is a /d/... MSYS path that Windows node cannot resolve.
VERSION="$(cd "$APP_DIR" && node -p "require('./app.json').expo.version")"
SIZE="$(stat -c%s "$APK")"
SHA256="$(sha256sum "$APK" | awk '{print tolower($1)}')"
APK_NAME="remote365-host-${VERSION}.apk"
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

# Identity check: a monorepo-misrooted bundler can embed the WRONG app's JS
# (it happened to the viewer APK). The latest.json path literal only exists in
# this app's self-updater code.
# grep -c (not -q): -q quits at the first match, unzip dies on EPIPE, and
# pipefail turns a successful match into a pipeline failure.
HOST_MARKS="$(unzip -p "$APK" assets/index.android.bundle | grep -ac "downloads/mobile/latest.json" || true)"
[ "${HOST_MARKS:-0}" -ge 1 ] || {
  echo "APK bundle is missing the host self-updater marker — wrong app bundled? Refusing." >&2
  exit 1
}

# The APK embeds its backend at bundle time (EXPO_PUBLIC_API_BASE_URL); refuse
# to ship a build whose Hermes bundle points at the other environment — a
# prod-flavored APK pushed to preprod would strand the whole preprod fleet
# (and vice versa) via self-update.
BUNDLE_HOSTS="$(unzip -p "$APK" assets/index.android.bundle | grep -ao 'https://[a-z.]*remote365\.ai' | sort -u || true)"
# ALLOW_FLAVOR_MISMATCH=1 is a deliberate, logged opt-out (used to serve the
# preprod-backed host from the prod download page while prod's auth-service
# lags). Read the self-update warning below before setting it.
if [ "${ALLOW_FLAVOR_MISMATCH:-0}" = "1" ]; then
  echo "!! ALLOW_FLAVOR_MISMATCH=1 — publishing a bundle that targets: $BUNDLE_HOSTS" >&2
  echo "!! New installs from '$TARGET' will register on the host above." >&2
  echo "!! Existing hosts only migrate if this VERSION is strictly newer than" >&2
  echo "!! theirs (updater uses isNewerVersion) — bumping the version later" >&2
  echo "!! WILL move the whole '$TARGET' fleet onto that backend." >&2
else
  case "$TARGET" in
    prod)    echo "$BUNDLE_HOSTS" | grep -q 'https://pp\.remote365\.ai' && { echo "APK bundle points at PREPROD; rebuild with EXPO_PUBLIC_API_BASE_URL=https://remote365.ai (+ SIGNALING_URL/TURN_HOST), or set ALLOW_FLAVOR_MISMATCH=1 if intended." >&2; exit 1; } ;;
    preprod) echo "$BUNDLE_HOSTS" | grep -q 'https://pp\.remote365\.ai' || { echo "APK bundle does not point at preprod; rebuild with EXPO_PUBLIC_API_BASE_URL=https://pp.remote365.ai (+ SIGNALING_URL/TURN_HOST)." >&2; exit 1; } ;;
  esac
fi

echo "Publishing mobile host $VERSION ($SIZE bytes, SHA-256 $SHA256) to $TARGET"

# Upload to a staging name, then move into place, so an interrupted transfer
# never leaves a truncated APK at the advertised filename.
ssh -o BatchMode=yes "$HOST" "mkdir -p '$REMOTE_DIR'"
scp -o ConnectTimeout=20 "$APK" "$HOST:$REMOTE_DIR/.staging-$APK_NAME"
ssh -o BatchMode=yes "$HOST" "mv -f '$REMOTE_DIR/.staging-$APK_NAME' '$REMOTE_DIR/$APK_NAME'"

REMOTE_SIZE="$(ssh -o BatchMode=yes "$HOST" "stat -c%s '$REMOTE_DIR/$APK_NAME'")"
[ "$REMOTE_SIZE" = "$SIZE" ] || { echo "Size mismatch: local $SIZE vs remote $REMOTE_SIZE" >&2; exit 1; }
REMOTE_SHA256="$(ssh -o BatchMode=yes "$HOST" "sha256sum '$REMOTE_DIR/$APK_NAME' | awk '{print tolower(\$1)}'")"
[ "$REMOTE_SHA256" = "$SHA256" ] || { echo "SHA-256 mismatch after upload." >&2; exit 1; }
echo "APK verified on server ($REMOTE_SIZE bytes, SHA-256 $REMOTE_SHA256)"

# Stable alias the website's Downloads page links to.
ssh -o BatchMode=yes "$HOST" "ln -sfn '$APK_NAME' '$REMOTE_DIR/Remote365-Host.apk'"

# Manifest last.
NOTES="${NOTES:-Performance and video quality improvements.}"
NOTES_JSON="$(NOTES="$NOTES" node -p "JSON.stringify(process.env.NOTES)")"
MANDATORY="${MANDATORY:-false}"
case "$MANDATORY" in true|false) ;; *) echo "MANDATORY must be true or false." >&2; exit 1 ;; esac
ssh -o BatchMode=yes "$HOST" "cat > '$REMOTE_DIR/latest.json'" <<EOF
{
  "version": "$VERSION",
  "url": "/downloads/mobile/$APK_NAME",
  "sha256": "$SHA256",
  "size": $SIZE,
  "notes": $NOTES_JSON,
  "mandatory": $MANDATORY
}
EOF

echo "Published. Verify:"
echo "  curl -s $BASE_URL/downloads/mobile/latest.json"
curl -s "$BASE_URL/downloads/mobile/latest.json" || true
echo
