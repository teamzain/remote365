# Install the published Remote 365 Android host on every phone attached to this PC.
#
# INSTALL ONLY - no permissions, no onboarding, no settings changes. Use
# provision-fleet.ps1 when you want the full setup (permissions + onboarding +
# hosting). Pairs with uninstall-mobile-fleet.ps1 for a clean replace cycle.
#
# Runs standalone: copy just this .ps1 to any Windows PC with the phones attached.
# If adb is missing it fetches Google's platform-tools; the APK is downloaded from
# the Remote 365 server (once, cached) and its SHA-256 is verified against the
# update manifest before anything is pushed to a phone.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File install-mobile-fleet.ps1
#   powershell -ExecutionPolicy Bypass -File install-mobile-fleet.ps1 -Server prod
#   powershell -ExecutionPolicy Bypass -File install-mobile-fleet.ps1 -Apk C:\path\app-release.apk
#   powershell -ExecutionPolicy Bypass -File install-mobile-fleet.ps1 -Serials R58N123ABC,192.168.2.100:5555

[CmdletBinding()]
param(
    # Local APK to install. When omitted, the published build is downloaded from -Server.
    [string]$Apk,

    # Which server's published build to install.
    [ValidateSet('preprod', 'prod')]
    [string]$Server = 'preprod',

    # Restrict to specific serials (default: every connected device).
    [string[]]$Serials,

    # Don't fetch Android platform-tools when adb is missing.
    [switch]$NoAdbBootstrap
)

$ErrorActionPreference = 'Continue'
$pkg = 'ai.remote365.mobilehost'
# PowerShell 5.1 still negotiates TLS 1.0 by default, which every modern host rejects.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

$workDir = Join-Path $env:TEMP 'remote365-fleet'
if (-not (Test-Path $workDir)) { New-Item -ItemType Directory -Path $workDir -Force | Out-Null }
if ($Server -eq 'prod') { $baseUrl = 'https://remote365.ai' } else { $baseUrl = 'https://pp.remote365.ai' }

# ---------------------------------------------------------------- adb
if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    if ($NoAdbBootstrap) {
        Write-Host "adb is not on PATH and -NoAdbBootstrap was passed. Install platform-tools first." -ForegroundColor Red
        exit 1
    }
    $adbExe = Join-Path $workDir 'platform-tools\adb.exe'
    if (-not (Test-Path $adbExe)) {
        $ptUrl = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip'
        Write-Host "adb not found. Downloading Android platform-tools from Google..." -ForegroundColor Yellow
        $ptZip = Join-Path $workDir 'platform-tools.zip'
        try {
            Invoke-WebRequest -Uri $ptUrl -OutFile $ptZip -UseBasicParsing
            Expand-Archive -Path $ptZip -DestinationPath $workDir -Force
            Remove-Item $ptZip -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Host "Could not download platform-tools: $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
    }
    if (-not (Test-Path $adbExe)) {
        Write-Host "platform-tools downloaded but adb.exe is missing." -ForegroundColor Red
        exit 1
    }
    $env:PATH = "$(Split-Path -Parent $adbExe);$env:PATH"
    Write-Host "adb ready: $adbExe" -ForegroundColor Green
}

# ---------------------------------------------------------------- devices
adb start-server 2>$null | Out-Null
$deviceLines = adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\S' }
$targets = @()
foreach ($line in $deviceLines) {
    $parts = $line -split '\s+'
    if ($parts.Count -lt 2) { continue }
    $serial = $parts[0]
    $state = $parts[1]
    if ($Serials -and ($Serials -notcontains $serial)) { continue }
    if ($state -eq 'device') { $targets += $serial }
    else { Write-Host "Skipping $serial ($state) - authorise USB debugging on the phone or replug it." -ForegroundColor Yellow }
}
if ($targets.Count -eq 0) {
    Write-Host "No usable devices connected." -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------- APK
$manifest = $null
if (-not $Apk) {
    Write-Host "Reading $baseUrl/downloads/mobile/latest.json ..." -ForegroundColor Yellow
    try {
        $manifest = Invoke-RestMethod -Uri "$baseUrl/downloads/mobile/latest.json?t=$(Get-Random)" -UseBasicParsing
    } catch {
        Write-Host "Could not read the update manifest: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    if (-not $manifest.url) { Write-Host "Manifest has no APK url." -ForegroundColor Red; exit 1 }
    if ($manifest.url -match '^https?://') { $apkUrl = $manifest.url } else { $apkUrl = "$baseUrl$($manifest.url)" }
    Write-Host "Published version: $($manifest.version)" -ForegroundColor Cyan

    $Apk = Join-Path $workDir ([System.IO.Path]::GetFileName(($apkUrl -split '\?')[0]))
    # Downloaded once and cached, so a fleet of phones doesn't re-fetch 120 MB each.
    $haveIt = $false
    if ((Test-Path $Apk) -and $manifest.sha256) {
        $localSha = (Get-FileHash -Algorithm SHA256 -Path $Apk).Hash.ToLower()
        if ($localSha -eq ([string]$manifest.sha256).ToLower()) { $haveIt = $true; Write-Host "Using cached APK (checksum verified)." -ForegroundColor DarkGray }
        else { Remove-Item $Apk -Force -ErrorAction SilentlyContinue }
    }
    if (-not $haveIt) {
        Write-Host "Downloading $apkUrl ..." -ForegroundColor Yellow
        try {
            Invoke-WebRequest -Uri $apkUrl -OutFile $Apk -UseBasicParsing
        } catch {
            Write-Host "APK download failed: $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
        if ($manifest.sha256) {
            # A corrupted download would otherwise be pushed to every phone.
            $localSha = (Get-FileHash -Algorithm SHA256 -Path $Apk).Hash.ToLower()
            if ($localSha -ne ([string]$manifest.sha256).ToLower()) {
                Write-Host "Downloaded APK failed its SHA-256 check - aborting." -ForegroundColor Red
                Remove-Item $Apk -Force -ErrorAction SilentlyContinue
                exit 1
            }
            Write-Host "Checksum verified." -ForegroundColor Green
        }
    }
}
if (-not (Test-Path $Apk)) { Write-Host "APK not found: $Apk" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------- install
$results = @()
foreach ($serial in $targets) {
    $model = (adb -s $serial shell getprop ro.product.model 2>$null | Out-String).Trim()
    Write-Host ""
    Write-Host "=== $serial ($model)" -ForegroundColor Cyan

    # -r replaces an existing install and KEEPS its data (so an already-set-up phone
    # keeps its permissions and identity). On a freshly-uninstalled phone it is a
    # plain new install.
    $output = (adb -s $serial install -r $Apk 2>&1 | Out-String).Trim()
    if ($output -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE') {
        # Old build signed with a different key. Data is lost, but the 9-digit ID is
        # recovered from the hardware fingerprint on next registration.
        Write-Host "  Signature mismatch with the installed build - uninstalling first." -ForegroundColor Yellow
        adb -s $serial uninstall $pkg 2>$null | Out-Null
        $output = (adb -s $serial install $Apk 2>&1 | Out-String).Trim()
    }

    if ($output -match 'Success') {
        $version = ((adb -s $serial shell dumpsys package $pkg 2>$null | Out-String) -split "`n" | Where-Object { $_ -match 'versionName=' } | Select-Object -First 1)
        if ($version) { $version = $version.Trim() -replace '^versionName=', '' } else { $version = 'unknown' }
        Write-Host "  Installed ($version)." -ForegroundColor Green
        $results += [pscustomobject]@{ Serial = $serial; Model = $model; Result = "installed $version" }
    } else {
        Write-Host "  FAILED: $output" -ForegroundColor Red
        $results += [pscustomobject]@{ Serial = $serial; Model = $model; Result = "FAILED: $output" }
    }
}

# ---------------------------------------------------------------- summary
Write-Host ""
Write-Host "================ summary ================" -ForegroundColor Cyan
$results | Format-Table -AutoSize | Out-String | Write-Host
$failed = @($results | Where-Object { $_.Result -like 'FAILED*' })
if ($failed.Count -gt 0) {
    Write-Host "$($failed.Count) device(s) failed - see above." -ForegroundColor Red
    exit 1
}
Write-Host "Done. Note: a FRESH install still needs its permissions + onboarding done on the phone (or run provision-fleet.ps1)." -ForegroundColor Green
