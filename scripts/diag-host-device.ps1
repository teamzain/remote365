# Diagnose one Android host that will not register or start hosting.
#
# Answers, in order: is the process alive, did it crash, what screen is it
# actually on, and what has it logged. Those four together explain essentially
# every "ID unreadable / Start button not on screen" case.
#
# Usage:  powershell -ExecutionPolicy Bypass -File diag-host-device.ps1 R94Y400MASK

param([Parameter(Mandatory = $true)][string]$Serial)

$pkg = 'ai.remote365.mobilehost'
Write-Host "=== DIAGNOSING $Serial ===`n" -ForegroundColor Cyan

Write-Host "--- installed version ---" -ForegroundColor Yellow
(adb -s $Serial shell dumpsys package $pkg 2>$null) | Select-String 'versionName|versionCode|firstInstallTime|lastUpdateTime' | Select-Object -First 4

Write-Host "`n--- is the app process running? ---" -ForegroundColor Yellow
$pid_ = (adb -s $Serial shell pidof $pkg 2>$null)
if ($pid_) { Write-Host "running (pid $pid_)" -ForegroundColor Green } else { Write-Host "NOT RUNNING - it exited or crashed" -ForegroundColor Red }

Write-Host "`n--- screen state / what has focus ---" -ForegroundColor Yellow
(adb -s $Serial shell dumpsys window 2>$null) | Select-String 'mCurrentFocus|mFocusedApp|mDreamingLockscreen|mAwake' | Select-Object -First 5

Write-Host "`n--- crashes / errors ---" -ForegroundColor Yellow
$crash = (adb -s $Serial logcat -d -t 4000 2>$null) | Select-String 'FATAL EXCEPTION|AndroidRuntime|E ReactNativeJS|Unable to|ANR in' | Select-Object -Last 12
if ($crash) { $crash } else { Write-Host "(none found)" -ForegroundColor Green }

Write-Host "`n--- app's own log ---" -ForegroundColor Yellow
$applog = (adb -s $Serial logcat -d -t 4000 2>$null) | Select-String 'RemoteLinkHost|ReactNativeJS' | Select-Object -Last 15
if ($applog) { $applog } else { Write-Host "(nothing - the JS layer never ran)" -ForegroundColor Red }

Write-Host "`n--- permissions that gate hosting ---" -ForegroundColor Yellow
$a11y = (adb -s $Serial shell settings get secure enabled_accessibility_services 2>$null)
if ("$a11y" -like "*mobilehost*") { Write-Host "accessibility: GRANTED" -ForegroundColor Green } else { Write-Host "accessibility: MISSING" -ForegroundColor Red }
$overlay = (adb -s $Serial shell appops get $pkg SYSTEM_ALERT_WINDOW 2>$null)
Write-Host "overlay: $overlay"
$battery = (adb -s $Serial shell dumpsys deviceidle whitelist 2>$null) | Select-String $pkg
if ($battery) { Write-Host "battery whitelist: yes" -ForegroundColor Green } else { Write-Host "battery whitelist: no" -ForegroundColor DarkYellow }

Write-Host "`n--- text currently on screen ---" -ForegroundColor Yellow
adb -s $Serial shell uiautomator dump /sdcard/diag.xml *> $null
$xml = (adb -s $Serial shell cat /sdcard/diag.xml 2>$null) -join "`n"
if ($xml) {
    $texts = [regex]::Matches($xml, 'text="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_.Trim() -ne '' }
    if ($texts) { $texts | Select-Object -First 25 } else { Write-Host "(no text nodes - blank or secure screen)" -ForegroundColor DarkYellow }
} else { Write-Host "(could not dump UI)" -ForegroundColor Red }
adb -s $Serial shell rm -f /sdcard/diag.xml *> $null

Write-Host "`n=== END ===" -ForegroundColor Cyan
