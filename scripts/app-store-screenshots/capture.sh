#!/usr/bin/env bash
# Captures App Store screenshots of the iOS simulator build on a macOS runner.
# Expects: ./app (unpacked EAS simulator build), mock-api.mjs already listening on
# localhost:4000, and `maestro` on PATH. Writes PNGs to ./shots/<device>/.
set -euo pipefail

APP=$(find app -maxdepth 4 -name "*.app" -type d | head -1)
[ -n "$APP" ] || { echo "no .app found"; find app -maxdepth 4; exit 1; }
echo "app: $APP"

RUNTIME=$(xcrun simctl list runtimes ios -j | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d).runtimes.filter(x=>x.isAvailable&&x.platform==='iOS').sort((a,b)=>a.version.localeCompare(b.version,undefined,{numeric:true}));console.log(r[r.length-1].identifier)})")
echo "runtime: $RUNTIME"
xcrun simctl list devicetypes | grep -E "iPhone 1[6-9] Pro Max|iPad Pro 13" || true

FLOWS="01-launch 02-chat 03-meeting 04-devices 05-settings 06-upgrade"

shoot() {
  local name="$1" type="$2" out="$3" flowdir="$4"
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
  for f in $FLOWS; do
    if maestro --device "$udid" test "scripts/app-store-screenshots/flows/$flowdir/$f.yaml"; then
      sleep 2
      xcrun simctl io "$udid" screenshot "$out/$f.png"
    else
      echo "flow $f failed on $name"
      xcrun simctl io "$udid" screenshot "$out/FAILED-$f.png" || true
    fi
  done
  xcrun simctl shutdown "$udid" || true
}

shoot shot-iphone "iPhone 16 Pro Max" shots/iphone-6.9 iphone
shoot shot-ipad "iPad Pro 13-inch (M4)" shots/ipad-13 ipad

for f in shots/*/*.png; do echo "$f $(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/{printf "%s ", $2}')"; done
