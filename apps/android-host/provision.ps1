# Restores every Tier A grant the host needs. Run after any (re)install — an APK reinstall
# drops the PROJECT_MEDIA app-op, the accessibility service, and the IME selection, which is
# what keeps bringing back the consent dialog and killing remote input during development.
#
# Usage:  .\provision.ps1
param(
    [string]$Adb = "D:\Android\Sdk\platform-tools\adb.exe",
    [string]$Pkg = "ai.remote365.host"
)

$a11y = "$Pkg/ai.remote365.host.input.HostAccessibilityService"

Write-Host "== Tier A: silent capture ==" -ForegroundColor Cyan
& $Adb shell appops set $Pkg PROJECT_MEDIA allow
Write-Host ("PROJECT_MEDIA: " + ((& $Adb shell appops get $Pkg PROJECT_MEDIA) -join " "))

Write-Host "== WRITE_SECURE_SETTINGS (IME switch + a11y self-heal) ==" -ForegroundColor Cyan
& $Adb shell pm grant $Pkg android.permission.WRITE_SECURE_SETTINGS
& $Adb shell pm grant $Pkg android.permission.POST_NOTIFICATIONS

Write-Host "== Audio: mic/call + app playback to the viewer ==" -ForegroundColor Cyan
& $Adb shell pm grant $Pkg android.permission.RECORD_AUDIO

Write-Host "== Clipboard: allow reads (phone -> desktop sync) ==" -ForegroundColor Cyan
& $Adb shell appops set $Pkg READ_CLIPBOARD allow

Write-Host "== Battery: unrestricted ==" -ForegroundColor Cyan
& $Adb shell dumpsys deviceidle whitelist +$Pkg | Out-Null

Write-Host "== IME: enable headless keyboard (type-anywhere) ==" -ForegroundColor Cyan
# Enabled once here; the app only flips it to DEFAULT during a session and restores after,
# because the enabled-list setting is not app-writable on targetSdk 34+.
& $Adb shell ime enable "$Pkg/.input.HostImeService"

Write-Host "== ECM: clear restricted-settings lock (Android 15/16) ==" -ForegroundColor Cyan
# Android 15/16 Enhanced Confirmation Mode rejects the accessibility write for sideloaded apps
# ("disallowed by device admin policy") unless this app-op is cleared first. Harmless on older OS.
& $Adb shell cmd appops set $Pkg ACCESS_RESTRICTED_SETTINGS allow

Write-Host "== Input: enable accessibility service ==" -ForegroundColor Cyan
$cur = (& $Adb shell settings get secure enabled_accessibility_services).Trim()
if ($cur -notlike "*$Pkg/*") {
    $next = if ($cur -eq "null" -or $cur -eq "") { $a11y } else { "$cur`:$a11y" }
    & $Adb shell settings put secure enabled_accessibility_services "$next"
}
& $Adb shell settings put secure accessibility_enabled 1
$after = (& $Adb shell settings get secure enabled_accessibility_services).Trim()
if ($after -like "*$Pkg/*") { Write-Host "input service: ENABLED" -ForegroundColor Green }
else { Write-Host "input service: STILL DISABLED" -ForegroundColor Red }

Write-Host "`nProvisioned. Restart the app:" -ForegroundColor Cyan
Write-Host "  $Adb shell am force-stop $Pkg; $Adb shell am start -n $Pkg/.ui.MainActivity"
