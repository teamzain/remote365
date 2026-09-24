$apk = "R:\apps\mobile-native-host\android\app\build\outputs\apk\release\app-release.apk"
$svc = "ai.remote365.mobilehost/ai.remote365.mobilehost.RemoteLinkAccessibilityService"
$serials = (adb devices) -split "`n" | Where-Object { $_ -match "\tdevice\s*$" } | ForEach-Object { ($_ -split "\s+")[0] }
Write-Host "Installing to $($serials.Count) devices..." -ForegroundColor Cyan
foreach ($s in $serials) {
  Write-Host "`n=== $s ===" -ForegroundColor Yellow
  adb -s $s install -r $apk
  $cur = (adb -s $s shell settings get secure enabled_accessibility_services).Trim()
  if ($cur -notlike "*mobilehost*") {
    if ($cur -eq "null" -or $cur -eq "") { $new = $svc } else { $new = "$cur`:$svc" }
    adb -s $s shell settings put secure enabled_accessibility_services $new
    adb -s $s shell settings put secure accessibility_enabled 1
    Write-Host "  accessibility re-enabled" -ForegroundColor Green
  } else {
    Write-Host "  accessibility already on" -ForegroundColor Green
  }
  $v = (adb -s $s shell dumpsys package ai.remote365.mobilehost | Select-String "versionName").ToString().Trim()
  Write-Host "  $v"
}
