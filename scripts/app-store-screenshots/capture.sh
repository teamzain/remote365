#!/usr/bin/env bash
# Captures App Store screenshots of the iOS simulator build on a macOS runner.
# Expects: ./app (unpacked EAS simulator build), mock-api.mjs already listening on
# localhost:4000, and `maestro` on PATH. Writes PNGs to ./shots/<device>/.
#
# Maestro cannot read text deep in the React Native tree on iOS, so screens are reached
# with taps at measured positions. Every screen starts from a fresh launch on the
# Connect tab, whose tab bar layout is the one the positions were measured on.
set -uo pipefail

APP=$(find app -maxdepth 4 -name "*.app" -type d | head -1)
[ -n "$APP" ] || { echo "no .app found"; find app -maxdepth 4; exit 1; }
echo "app: $APP"

RUNTIME=$(xcrun simctl list runtimes ios -j | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d).runtimes.filter(x=>x.isAvailable&&x.platform==='iOS').sort((a,b)=>a.version.localeCompare(b.version,undefined,{numeric:true}));console.log(r[r.length-1].identifier)})")
echo "runtime: $RUNTIME"
FLOWS=scripts/app-store-screenshots/flows

run() { # udid flow-file
  maestro --device "$1" test "$2" || echo "flow failed: $2"
}

# Tap, then confirm the screen changed; a tap right after a new Maestro session is
# sometimes dropped, so retry up to twice when the screenshot is byte-identical.
tap() { # udid flow-file
  local udid="$1" flow="$2" i
  xcrun simctl io "$udid" screenshot /tmp/before.png >/dev/null 2>&1
  for i in 1 2 3; do
    run "$udid" "$flow"; sleep 3
    xcrun simctl io "$udid" screenshot /tmp/after.png >/dev/null 2>&1
    cmp -s /tmp/before.png /tmp/after.png || return 0
    echo "screen unchanged after $flow (try $i)"
  done
}

shoot() {
  local name="$1" type="$2" out="$3" dev="$4"
  local udid
  udid=$(xcrun simctl create "$name" "$type" "$RUNTIME")
  echo "== $name ($type) $udid"
  xcrun simctl boot "$udid"
  xcrun simctl bootstatus "$udid" -b
  xcrun simctl ui "$udid" appearance light
  xcrun simctl status_bar "$udid" override --time "9:41" --dataNetwork wifi --wifiMode active --wifiBars 3 \
    --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
  xcrun simctl install "$udid" "$APP"

  local data dir
  data=$(xcrun simctl get_app_container "$udid" ai.remote365.mobile data)
  dir="$data/Library/Application Support/ai.remote365.mobile/RCTAsyncLocalStorage_V1"
  mkdir -p "$dir"
  node scripts/app-store-screenshots/seed-manifest.mjs > "$dir/manifest.json"
  mkdir -p "$out"

  run "$udid" "$FLOWS/launch.yaml"; sleep 3
  xcrun simctl io "$udid" screenshot "$out/02-connect.png"

  for target in chat:04-chat meeting:03-meeting devices:01-devices; do
    run "$udid" "$FLOWS/launch.yaml"; sleep 3
    tap "$udid" "$FLOWS/$dev/tap-${target%%:*}.yaml"
    xcrun simctl io "$udid" screenshot "$out/${target##*:}.png"
  done

  run "$udid" "$FLOWS/launch.yaml"; sleep 3
  tap "$udid" "$FLOWS/$dev/tap-settings.yaml"
  xcrun simctl io "$udid" screenshot "$out/x-settings.png"
  tap "$udid" "$FLOWS/$dev/tap-upgrade.yaml"; sleep 1
  xcrun simctl io "$udid" screenshot "$out/x-upgrade.png"

  xcrun simctl shutdown "$udid" || true
}

shoot shot-iphone "iPhone 16 Pro Max" shots/iphone-6.9 iphone
shoot shot-ipad "iPad Pro 13-inch (M4)" shots/ipad-13 ipad

for f in shots/*/*.png; do echo "$f $(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/{printf "%s ", $2}')"; done
