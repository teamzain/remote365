# First-run setup + repair for the Remote 365 Android host fleet.
#
# Grants the four permissions the onboarding asks for (accessibility,
# notifications, overlay, battery) directly over adb, walks the device through
# any remaining onboarding, starts hosting, and reports each device's ID.
#
# Also REPAIRS devices whose accessibility grant was lost. That matters more than
# it sounds: without accessibility the phone still streams video but silently
# ignores every tap, which looks like "connected but frozen".
#
# Safe to re-run. Devices already set up and hosting are left alone.
#
# Usage:  powershell -ExecutionPolicy Bypass -File setup-host-fleet.ps1

$ErrorActionPreference = 'Continue'
$pkg = 'ai.remote365.mobilehost'
$activity = "$pkg/$pkg.MainActivity"
$a11ySvc = "$pkg/$pkg.RemoteLinkAccessibilityService"

function Test-Hosting($s) {
    $svc = (adb -s $s shell dumpsys activity services $pkg 2>$null) -join "`n"
    return ($svc -match 'BackgroundService' -or $svc -match 'MediaProjectionService')
}

function Get-HostIdFromLog($s) {
    $log = (adb -s $s logcat -d 2>$null) -join "`n"
    $m = [regex]::Matches($log, 'RemoteLinkHost\].*?(?:accessKey|sessionId)"\s*:\s*"(\d{4,})"')
    if ($m.Count -gt 0) { return $m[$m.Count - 1].Groups[1].Value }
    return $null
}

function Get-Ui($s) {
    for ($i = 0; $i -lt 3; $i++) {
        adb -s $s shell uiautomator dump /sdcard/r365.xml *> $null
        $xml = (adb -s $s shell cat /sdcard/r365.xml 2>$null) -join "`n"
        if ($xml -and $xml.Contains('<hierarchy')) { return $xml }
        Start-Sleep -Milliseconds 800
    }
    return $null
}

function Tap-Text($s, $xml, $pattern) {
    $rx = [regex]('<node[^>]*?text="(' + $pattern + ')"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
    $m = $rx.Match($xml)
    if (-not $m.Success) { return $false }
    $x = [int](([int]$m.Groups[2].Value + [int]$m.Groups[4].Value) / 2)
    $y = [int](([int]$m.Groups[3].Value + [int]$m.Groups[5].Value) / 2)
    adb -s $s shell input tap $x $y *> $null
    return $true
}

$serials = (adb devices) -split "`n" | Where-Object { $_ -match "\tdevice\s*$" } | ForEach-Object { ($_ -split "\s+")[0] }
if (-not $serials) { Write-Host "No devices found." -ForegroundColor Red; exit 1 }

Write-Host "Setting up $($serials.Count) devices...`n" -ForegroundColor Cyan
$results = @()

foreach ($s in $serials) {
    Write-Host "=== $s ===" -ForegroundColor Yellow
    $row = [ordered]@{ Serial = $s; ID = ''; Hosting = ''; Fixed = '' }
    $fixed = @()

    # ---- 1. Permissions, all grantable from adb ----
    $cur = "$(adb -s $s shell settings get secure enabled_accessibility_services 2>$null)".Trim()
    if ($cur -notlike "*mobilehost*") {
        # Append rather than replace, so other services (TeamViewer, Samsung) survive.
        if ($cur -eq 'null' -or $cur -eq '') { $new = $a11ySvc } else { $new = "$cur`:$a11ySvc" }
        adb -s $s shell settings put secure enabled_accessibility_services "$new" *> $null
        adb -s $s shell settings put secure accessibility_enabled 1 *> $null
        $fixed += 'accessibility'
        Write-Host "  granted accessibility" -ForegroundColor Green
    }

    $ov = "$(adb -s $s shell appops get $pkg SYSTEM_ALERT_WINDOW 2>$null)"
    if ($ov -notmatch 'allow') {
        adb -s $s shell appops set $pkg SYSTEM_ALERT_WINDOW allow *> $null
        $fixed += 'overlay'
        Write-Host "  granted overlay" -ForegroundColor Green
    }

    $bat = (adb -s $s shell dumpsys deviceidle whitelist 2>$null) | Select-String $pkg
    if (-not $bat) {
        adb -s $s shell dumpsys deviceidle whitelist +$pkg *> $null
        $fixed += 'battery'
        Write-Host "  granted battery exemption" -ForegroundColor Green
    }

    adb -s $s shell pm grant $pkg android.permission.POST_NOTIFICATIONS *> $null

    $row.Fixed = if ($fixed.Count) { $fixed -join '+' } else { 'nothing needed' }

    # ---- 2. Restart only when nothing is live ----
    $wasHosting = Test-Hosting $s
    if (-not $wasHosting) {
        adb -s $s logcat -c *> $null
        adb -s $s shell am force-stop $pkg *> $null
        Start-Sleep -Milliseconds 900
    }
    adb -s $s shell input keyevent KEYCODE_WAKEUP *> $null
    adb -s $s shell wm dismiss-keyguard *> $null
    adb -s $s shell am start -n $activity *> $null
    Start-Sleep -Seconds 5

    # ---- 3. Walk any remaining onboarding ----
    for ($step = 0; $step -lt 8; $step++) {
        $xml = Get-Ui $s
        if (-not $xml) { break }
        if ($xml -match 'Your ID' -or $xml -match 'Start Hosting' -or $xml -match 'Stop Hosting') { break }
        # Tap the step's primary action; never "Skip Setup", which abandons setup.
        $acted = Tap-Text $s $xml 'Enable Accessibility|Allow Notifications|Allow Overlay|Disable Battery Optimization|Continue|Get Started|Finish'
        if (-not $acted) { break }
        Start-Sleep -Seconds 3
        # Some steps bounce out to a system settings page; come back.
        $f = "$(adb -s $s shell dumpsys window 2>$null)"
        if ($f -notmatch [regex]::Escape($pkg)) {
            adb -s $s shell input keyevent KEYCODE_BACK *> $null
            Start-Sleep -Seconds 2
            adb -s $s shell am start -n $activity *> $null
            Start-Sleep -Seconds 3
        }
    }

    # ---- 4. ID ----
    $id = $null
    for ($w = 0; $w -lt 10; $w++) {
        $id = Get-HostIdFromLog $s
        if ($id) { break }
        Start-Sleep -Seconds 2
    }
    if ($id) { $row.ID = $id; Write-Host "  ID: $id" -ForegroundColor Green }
    else { $row.ID = 'unknown'; Write-Host "  ID still unreadable" -ForegroundColor Red }

    # ---- 5. Hosting ----
    if (Test-Hosting $s) {
        $row.Hosting = 'online'
        Write-Host "  hosting: online" -ForegroundColor Green
    } else {
        $xml = Get-Ui $s
        if ($xml -and (Tap-Text $s $xml 'Start Hosting')) {
            Start-Sleep -Seconds 5
            if (Test-Hosting $s) { $row.Hosting = 'started'; Write-Host "  hosting: STARTED" -ForegroundColor Green }
            else { $row.Hosting = 'not confirmed'; Write-Host "  hosting: tapped, not confirmed" -ForegroundColor DarkYellow }
        } else {
            $row.Hosting = 'not started'
            Write-Host "  hosting: could not find Start button" -ForegroundColor Red
        }
    }

    adb -s $s shell rm -f /sdcard/r365.xml *> $null
    $results += [pscustomobject]$row
}

Write-Host "`n================ RESULT ================" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$csv = Join-Path $env:USERPROFILE 'remote365-device-ids.csv'
$results | Export-Csv -NoTypeInformation -Path $csv
Write-Host "Saved to $csv" -ForegroundColor Cyan
Write-Host "Send me this table and I will enable easy access for any new IDs." -ForegroundColor Cyan
