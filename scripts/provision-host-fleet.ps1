# Fleet provisioning for the Remote 365 Android host  (v3)
#
# v2 had two bugs this fixes:
#   1. It cleared logcat BEFORE reading it, throwing away the registration line
#      the device had already written — so an long-registered device looked
#      "never registered".
#   2. It force-stopped every device, which KILLS a live hosting session just to
#      read an ID. v3 never restarts a device that is already hosting.
#
# Order of preference for reading the ID (least disruptive first):
#   a. existing logcat            - no disruption at all
#   b. resume the app + re-read   - for a running-but-quiet app
#   c. full restart               - only when the device is NOT hosting
#
# The ID is only ever written by the JS layer, which needs the Activity to run,
# so a PIN-locked screen can genuinely prevent reading it. That case is reported
# honestly rather than mislabelled "never registered".
#
# Usage:  powershell -ExecutionPolicy Bypass -File provision-host-fleet.ps1

$ErrorActionPreference = 'Continue'
$pkg = 'ai.remote365.mobilehost'
$activity = "$pkg/$pkg.MainActivity"

function Test-Locked($serial) {
    $w = (adb -s $serial shell dumpsys window 2>$null) -join "`n"
    return ($w -match 'mDreamingLockscreen=true' -or $w -match 'isStatusBarKeyguard=true')
}

function Test-Hosting($serial) {
    $svc = (adb -s $serial shell dumpsys activity services $pkg 2>$null) -join "`n"
    return ($svc -match 'BackgroundService' -or $svc -match 'MediaProjectionService')
}

function Get-HostIdFromLog($serial) {
    $log = (adb -s $serial logcat -d 2>$null) -join "`n"
    $rx = [regex]'RemoteLinkHost\].*?(?:accessKey|sessionId)"\s*:\s*"(\d{4,})"'
    $m = $rx.Matches($log)
    if ($m.Count -gt 0) { return $m[$m.Count - 1].Groups[1].Value }
    return $null
}

$serials = (adb devices) -split "`n" | Where-Object { $_ -match "\tdevice\s*$" } | ForEach-Object { ($_ -split "\s+")[0] }
if (-not $serials) { Write-Host "No devices found." -ForegroundColor Red; exit 1 }

Write-Host "Provisioning $($serials.Count) devices...`n" -ForegroundColor Cyan
$results = @()

foreach ($s in $serials) {
    Write-Host "=== $s ===" -ForegroundColor Yellow
    $row = [ordered]@{ Serial = $s; ID = ''; Hosting = ''; Note = '' }

    $locked = Test-Locked $s
    $hosting = Test-Hosting $s

    # Try to get past a simple swipe lock; a PIN will still block us.
    adb -s $s shell input keyevent KEYCODE_WAKEUP *> $null
    adb -s $s shell wm dismiss-keyguard *> $null
    Start-Sleep -Milliseconds 700

    # (a) Read what is ALREADY in the log — costs nothing and disturbs nothing.
    $id = Get-HostIdFromLog $s

    # (b) Still nothing: bring the app forward (no kill) and give it a moment.
    if (-not $id) {
        adb -s $s shell am start -n $activity *> $null
        for ($w = 0; $w -lt 6; $w++) {
            Start-Sleep -Seconds 2
            $id = Get-HostIdFromLog $s
            if ($id) { break }
        }
    }

    # (c) Last resort, and ONLY when nothing would be interrupted.
    if (-not $id -and -not $hosting) {
        Write-Host "  restarting app to force a fresh registration..." -ForegroundColor DarkGray
        adb -s $s logcat -c *> $null
        adb -s $s shell am force-stop $pkg *> $null
        Start-Sleep -Milliseconds 800
        adb -s $s shell am start -n $activity *> $null
        for ($w = 0; $w -lt 12; $w++) {
            Start-Sleep -Seconds 2
            $id = Get-HostIdFromLog $s
            if ($id) { break }
        }
    }

    if ($id) {
        $row.ID = $id
        Write-Host "  ID: $id" -ForegroundColor Green
    } elseif ($locked) {
        $row.ID = 'locked'
        $row.Note = 'PIN-locked - unlock the phone and re-run'
        Write-Host "  ID unreadable: phone is PIN-locked (it IS registered, just not readable)" -ForegroundColor DarkYellow
    } else {
        $row.ID = 'unknown'
        $row.Note = 'app never logged a registration'
        Write-Host "  ID unreadable" -ForegroundColor Red
    }

    # Hosting: start it only if it genuinely is not running.
    if ($hosting -or (Test-Hosting $s)) {
        $row.Hosting = 'online'
        Write-Host "  hosting: online" -ForegroundColor Green
    } else {
        $xml = $null
        for ($i = 0; $i -lt 3; $i++) {
            adb -s $s shell uiautomator dump /sdcard/r365ui.xml *> $null
            $xml = (adb -s $s shell cat /sdcard/r365ui.xml 2>$null) -join "`n"
            if ($xml -and $xml.Contains('<hierarchy')) { break }
            Start-Sleep -Milliseconds 900
        }
        $rx = [regex]'<node[^>]*?text="Start Hosting"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
        $m = if ($xml) { $rx.Match($xml) } else { $null }
        if ($m -and $m.Success) {
            $x = [int](([int]$m.Groups[1].Value + [int]$m.Groups[3].Value) / 2)
            $y = [int](([int]$m.Groups[2].Value + [int]$m.Groups[4].Value) / 2)
            adb -s $s shell input tap $x $y *> $null
            Start-Sleep -Seconds 5
            if (Test-Hosting $s) {
                $row.Hosting = 'started'
                Write-Host "  hosting: STARTED" -ForegroundColor Green
            } else {
                $row.Hosting = 'tap sent, not confirmed'
                Write-Host "  hosting: tapped, service did not come up (check permissions)" -ForegroundColor DarkYellow
            }
        } else {
            $row.Hosting = 'not started'
            if ($locked) { Write-Host "  hosting: cannot reach the button (locked)" -ForegroundColor DarkYellow }
            else { Write-Host "  hosting: Start button not on screen" -ForegroundColor Red }
        }
        adb -s $s shell rm -f /sdcard/r365ui.xml *> $null
    }

    $results += [pscustomobject]$row
}

Write-Host "`n================ RESULT ================" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$csv = Join-Path $env:USERPROFILE 'remote365-device-ids.csv'
$results | Export-Csv -NoTypeInformation -Path $csv
Write-Host "Saved to $csv" -ForegroundColor Cyan
