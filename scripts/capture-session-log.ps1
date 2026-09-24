# Capture what the Android host ACTUALLY does during one remote session.
#
# The host already logs everything needed to tell input lag from video lag from a
# dead capture - it just goes to logcat on the phone where nobody reads it. This
# records a session and prints the numbers that decide what is wrong, instead of
# guessing from the code.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File capture-session-log.ps1
#   powershell -ExecutionPolicy Bypass -File capture-session-log.ps1 -Seconds 90
#
# Run it, then connect to the phone from your viewer and USE it (click, scroll)
# until the script says it is done. It writes remote365-session-log.txt next to
# itself - send me that file.

[CmdletBinding()]
param(
    [string]$Serial,
    [int]$Seconds = 60,
    [string]$Out = 'remote365-session-log.txt'
)

$ErrorActionPreference = 'Continue'
$pkg = 'ai.remote365.mobilehost'

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    $bundled = Join-Path $env:TEMP 'remote365-fleet\platform-tools\adb.exe'
    if (Test-Path $bundled) { $env:PATH = "$(Split-Path -Parent $bundled);$env:PATH" }
    else { Write-Host "adb not found. Run install-mobile-fleet.ps1 once first (it fetches adb)." -ForegroundColor Red; exit 1 }
}

if (-not $Serial) {
    $devices = @(adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' } | ForEach-Object { ($_ -split '\s+')[0] })
    if ($devices.Count -eq 0) { Write-Host "No device connected." -ForegroundColor Red; exit 1 }
    if ($devices.Count -gt 1) { Write-Host "Multiple devices - pass -Serial <serial>:"; $devices | ForEach-Object { Write-Host "  $_" }; exit 1 }
    $Serial = $devices[0]
}

$model = (adb -s $Serial shell getprop ro.product.model 2>$null | Out-String).Trim()
$android = (adb -s $Serial shell getprop ro.build.version.release 2>$null | Out-String).Trim()
$version = ((adb -s $Serial shell dumpsys package $pkg 2>$null | Out-String) -split "`n" | Where-Object { $_ -match 'versionName=' } | Select-Object -First 1)
if ($version) { $version = $version.Trim() } else { $version = 'versionName=NOT INSTALLED' }

Write-Host "Device : $Serial ($model, Android $android)" -ForegroundColor Cyan
Write-Host "App    : $version" -ForegroundColor Cyan

$a11y = (adb -s $Serial shell settings get secure enabled_accessibility_services 2>$null | Out-String)
$a11yOk = $a11y -like "*mobilehost*"
if ($a11yOk) { Write-Host "A11y   : GRANTED" -ForegroundColor Green } else { Write-Host "A11y   : MISSING - the consent dialog can never be auto-accepted" -ForegroundColor Red }

adb -s $Serial logcat -c 2>$null | Out-Null

Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host " CONNECT TO THE PHONE NOW, AND USE IT." -ForegroundColor Yellow
Write-Host " Click things. Scroll. Let it be laggy." -ForegroundColor Yellow
Write-Host " Recording for $Seconds seconds..." -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow

$job = Start-Job -ScriptBlock { param($s) & adb -s $s logcat -v time } -ArgumentList $Serial
for ($i = $Seconds; $i -gt 0; $i -= 5) {
    Start-Sleep -Seconds ([Math]::Min(5, $i))
    Write-Host "  $i s left..." -ForegroundColor DarkGray
}
$raw = Receive-Job $job
Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -Force -ErrorAction SilentlyContinue

$lines = @($raw -split "`r?`n")
$keep = $lines | Where-Object { $_ -match 'RemoteLinkHost|Remote365Latency|Remote365Update|RemoteLink|ReactNativeJS|MediaProjection|FATAL|AndroidRuntime|ANR in' }

$header = @(
    "device=$Serial model=$model android=$android",
    "app=$version accessibility=$(if ($a11yOk) { 'granted' } else { 'MISSING' })",
    "captured=$(Get-Date -Format o) seconds=$Seconds",
    ''
)
($header + $keep) | Set-Content -Path $Out -Encoding utf8

Write-Host ""
Write-Host "================ WHAT THE PHONE REPORTED ================" -ForegroundColor Cyan

$perf = @($keep | Where-Object { $_ -match 'performance:video' })
if ($perf.Count -gt 0) {
    Write-Host "`n--- video encoder (last 5 samples) ---" -ForegroundColor Yellow
    $perf | Select-Object -Last 5 | ForEach-Object { Write-Host "  $_" }

    # qualityLimitationReason is the single field that says WHY it is slow.
    $cpu = @($perf | Where-Object { $_ -match '"qualityLimitationReason":"cpu"' }).Count
    $bw  = @($perf | Where-Object { $_ -match '"qualityLimitationReason":"bandwidth"' }).Count
    $none = @($perf | Where-Object { $_ -match '"qualityLimitationReason":"none"' }).Count
    Write-Host "`n--- why is it limited? ---" -ForegroundColor Yellow
    Write-Host "  cpu=$cpu  bandwidth=$bw  none=$none"
    if ($cpu -gt $bw -and $cpu -gt 0) { Write-Host "  => ENCODER-BOUND: the phone cannot encode this fast enough." -ForegroundColor Magenta }
    elseif ($bw -gt 0) { Write-Host "  => BANDWIDTH-BOUND: the link cannot carry this bitrate." -ForegroundColor Magenta }
    elseif ($none -gt 0) { Write-Host "  => NOT limited by encode or bandwidth - lag is elsewhere (input path)." -ForegroundColor Magenta }
} else {
    Write-Host "`nNo video stats - the session never reached 'connected'." -ForegroundColor Red
}

$inputs = @($keep | Where-Object { $_ -match 'input-executed' })
if ($inputs.Count -gt 0) {
    $ms = $inputs | ForEach-Object { if ($_ -match 'executionMs=(\d+)') { [int]$Matches[1] } } | Where-Object { $_ -ne $null }
    if ($ms) {
        $avg = [Math]::Round(($ms | Measure-Object -Average).Average, 1)
        $max = ($ms | Measure-Object -Maximum).Maximum
        Write-Host "`n--- input injection on the phone ---" -ForegroundColor Yellow
        Write-Host "  $($ms.Count) inputs, avg ${avg}ms, worst ${max}ms"
        if ($avg -gt 120) { Write-Host "  => the phone itself is slow to execute taps." -ForegroundColor Magenta }
        else { Write-Host "  => the phone executes taps promptly; delay is video or network." -ForegroundColor Magenta }
    }
}

$transport = @($keep | Where-Object { $_ -match 'estimatedTransportMs' })
if ($transport.Count -gt 0) {
    Write-Host "`n--- click travel time (viewer -> phone) ---" -ForegroundColor Yellow
    $transport | Select-Object -Last 3 | ForEach-Object { Write-Host "  $_" }
}

$capture = @($keep | Where-Object { $_ -match 'capture:|consent|Another operation|No current Activity|dead-restart' })
if ($capture.Count -gt 0) {
    Write-Host "`n--- screen capture events ---" -ForegroundColor Yellow
    $capture | Select-Object -Last 8 | ForEach-Object { Write-Host "  $_" }
}

$crash = @($keep | Where-Object { $_ -match 'FATAL|AndroidRuntime|ANR in' })
if ($crash.Count -gt 0) {
    Write-Host "`n--- CRASHES ---" -ForegroundColor Red
    $crash | Select-Object -Last 6 | ForEach-Object { Write-Host "  $_" }
}

Write-Host "`nFull log written to: $Out" -ForegroundColor Green
Write-Host "Send me that file." -ForegroundColor Green
