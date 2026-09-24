# Uninstall the Remote 365 Android host from every phone attached to this PC.
#
# Removes BOTH generations of the host app when present:
#   * ai.remote365.mobilehost - legacy React Native host (provision-fleet.ps1 era)
#   * ai.remote365.host       - current native host (install-remote365-host.ps1)
# Pass -Packages to restrict to just one of them.
#
# Run THIS first when you want a clean slate (e.g. replacing old debug-signed
# builds that can't take OTA updates), then reinstall with
# install-remote365-host.ps1 (native host) or provision-fleet.ps1 (legacy app).
#
# Runs standalone: copy just this .ps1 to any Windows PC with the phones attached.
# If adb is missing it fetches Google's platform-tools automatically.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File uninstall-mobile-fleet.ps1 -DryRun
#   powershell -ExecutionPolicy Bypass -File uninstall-mobile-fleet.ps1 -Yes
#   powershell -ExecutionPolicy Bypass -File uninstall-mobile-fleet.ps1 -Serials R58N123ABC,192.168.2.100:5555
#   powershell -ExecutionPolicy Bypass -File uninstall-mobile-fleet.ps1 -Packages ai.remote365.host
# One-liner (no flags possible, but the YES prompt still gates removal):
#   irm https://pp.remote365.ai/downloads/mobile/uninstall-mobile-fleet.ps1 | iex
#
# The body lives in a function and never calls `exit`: under `irm | iex` there is no script
# scope, so a bare `exit` closes the operator's console window before the output can be read.
#
# Notes:
#  - Uninstalling wipes the app's data, but the phone's 9-digit Remote 365 ID is
#    recovered from the hardware fingerprint on the next install, so a reinstalled
#    phone keeps the SAME ID in your account.
#  - Each phone will show Offline in the dashboard the moment the app is removed.
#  - Phones must have USB debugging authorised ("Always allow from this computer").

[CmdletBinding()]
param(
    # Show what would be uninstalled without touching anything.
    [switch]$DryRun,

    # Skip the confirmation prompt (for unattended use).
    [switch]$Yes,

    # Restrict to specific serials (default: every connected device).
    [string[]]$Serials,

    # Host app package ids to remove (default: both the legacy and the native host).
    [string[]]$Packages = @('ai.remote365.mobilehost', 'ai.remote365.host'),

    # Don't fetch Android platform-tools when adb is missing.
    [switch]$NoAdbBootstrap
)

function Invoke-FleetUninstall {
    param([switch]$DryRun, [switch]$Yes, [string[]]$Serials, [string[]]$Packages, [switch]$NoAdbBootstrap)

    $ErrorActionPreference = 'Continue'
    # PowerShell 5.1 still negotiates TLS 1.0 by default, which every modern host rejects.
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue'

    $workDir = Join-Path $env:TEMP 'remote365-fleet'
    if (-not (Test-Path $workDir)) { New-Item -ItemType Directory -Path $workDir -Force | Out-Null }

    # ---------------------------------------------------------------- adb
    # A phone farm PC often has no Android SDK at all. Rather than making that a manual
    # prerequisite, fetch Google's official platform-tools into the temp dir for this run.
    if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
        if ($NoAdbBootstrap) {
            Write-Host "adb is not on PATH and -NoAdbBootstrap was passed. Install platform-tools first." -ForegroundColor Red
            return 1
        }
        $adbExe = Join-Path $workDir 'platform-tools\adb.exe'
        if (-not (Test-Path $adbExe)) {
            $ptUrl = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip'
            Write-Host "adb not found. Downloading Android platform-tools from Google..." -ForegroundColor Yellow
            Write-Host "  $ptUrl" -ForegroundColor DarkGray
            $ptZip = Join-Path $workDir 'platform-tools.zip'
            try {
                Invoke-WebRequest -Uri $ptUrl -OutFile $ptZip -UseBasicParsing
                Expand-Archive -Path $ptZip -DestinationPath $workDir -Force
                Remove-Item $ptZip -Force -ErrorAction SilentlyContinue
            } catch {
                Write-Host "Could not download platform-tools: $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "Install it manually from https://developer.android.com/tools/releases/platform-tools" -ForegroundColor DarkGray
                return 1
            }
        }
        if (-not (Test-Path $adbExe)) {
            Write-Host "platform-tools downloaded but adb.exe is missing." -ForegroundColor Red
            return 1
        }
        $env:PATH = "$(Split-Path -Parent $adbExe);$env:PATH"
        Write-Host "adb ready: $adbExe" -ForegroundColor Green
    }

    # ---------------------------------------------------------------- devices
    adb start-server 2>$null | Out-Null
    $deviceLines = adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\S' }
    $targets = @()
    $skipped = @()
    foreach ($line in $deviceLines) {
        $parts = $line -split '\s+'
        if ($parts.Count -lt 2) { continue }
        $serial = $parts[0]
        $state = $parts[1]
        if ($Serials -and ($Serials -notcontains $serial)) { continue }
        if ($state -eq 'device') { $targets += $serial }
        else { $skipped += "$serial ($state)" }
    }

    foreach ($entry in $skipped) {
        # 'unauthorized' = the phone is showing the USB-debugging prompt; 'offline' = replug.
        Write-Host "Skipping $entry - authorise USB debugging on the phone or replug it." -ForegroundColor Yellow
    }

    if ($targets.Count -eq 0) {
        Write-Host "No usable devices connected." -ForegroundColor Red
        return 1
    }

    Write-Host ""
    Write-Host "Will uninstall $($Packages -join ' + ') from $($targets.Count) device(s):" -ForegroundColor Cyan
    foreach ($serial in $targets) {
        $model = (adb -s $serial shell getprop ro.product.model 2>$null | Out-String).Trim()
        $present = @()
        foreach ($pkg in $Packages) {
            if ((adb -s $serial shell pm path $pkg 2>$null | Out-String).Trim()) { $present += $pkg }
        }
        $note = if ($present.Count -gt 0) { $present -join ', ' } else { 'nothing to remove' }
        Write-Host ("  {0}  {1}  [{2}]" -f $serial, $model, $note)
    }

    if ($DryRun) {
        Write-Host ""
        Write-Host "Dry run - nothing was uninstalled." -ForegroundColor Green
        return 0
    }

    if (-not $Yes) {
        Write-Host ""
        $answer = Read-Host "Type YES to uninstall from all devices listed above"
        if ($answer -cne 'YES') { Write-Host "Aborted."; return 1 }
    }

    # ---------------------------------------------------------------- uninstall
    $results = @()
    foreach ($serial in $targets) {
        $model = (adb -s $serial shell getprop ro.product.model 2>$null | Out-String).Trim()
        Write-Host ""
        Write-Host "=== $serial ($model)" -ForegroundColor Cyan

        foreach ($pkg in $Packages) {
            $installedPath = (adb -s $serial shell pm path $pkg 2>$null | Out-String).Trim()
            if (-not $installedPath) {
                Write-Host "  $pkg : not installed - nothing to do." -ForegroundColor DarkGray
                $results += [pscustomobject]@{ Serial = $serial; Model = $model; Package = $pkg; Result = 'not installed' }
                continue
            }

            # Stop the foreground service first so the package isn't busy mid-uninstall.
            adb -s $serial shell am force-stop $pkg 2>$null | Out-Null

            $output = (adb -s $serial uninstall $pkg 2>&1 | Out-String).Trim()
            if ($output -notmatch 'Success') {
                # Fallback covers multi-user/work-profile leftovers where the plain form fails.
                $output = (adb -s $serial shell pm uninstall --user 0 $pkg 2>&1 | Out-String).Trim()
            }

            $stillThere = (adb -s $serial shell pm path $pkg 2>$null | Out-String).Trim()
            if (-not $stillThere) {
                Write-Host "  $pkg : uninstalled." -ForegroundColor Green
                $results += [pscustomobject]@{ Serial = $serial; Model = $model; Package = $pkg; Result = 'uninstalled' }
            } else {
                Write-Host "  $pkg : FAILED: $output" -ForegroundColor Red
                $results += [pscustomobject]@{ Serial = $serial; Model = $model; Package = $pkg; Result = "FAILED: $output" }
            }
        }
    }

    # ---------------------------------------------------------------- summary
    Write-Host ""
    Write-Host "================ summary ================" -ForegroundColor Cyan
    $results | Format-Table -AutoSize | Out-String | Write-Host
    $failed = @($results | Where-Object { $_.Result -like 'FAILED*' })
    if ($failed.Count -gt 0) {
        Write-Host "$($failed.Count) device(s) failed - see above." -ForegroundColor Red
        return 1
    }
    Write-Host "Done. Reinstall the native host with install-remote365-host.ps1, or the legacy app with provision-fleet.ps1." -ForegroundColor Green
    return 0
}

$fleetExit = Invoke-FleetUninstall -DryRun:$DryRun -Yes:$Yes -Serials $Serials -Packages $Packages -NoAdbBootstrap:$NoAdbBootstrap
# Exit codes only when running as a saved .ps1 (for automation); never under `irm | iex`.
if ($MyInvocation.MyCommand.Path) { exit $fleetExit }
