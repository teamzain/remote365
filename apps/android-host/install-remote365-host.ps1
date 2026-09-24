# Remote 365 Host — install on every Android phone connected to this PC.
#
# What it does: downloads the latest APK from the download server (or uses a local file you pass),
# then installs it on ALL authorised USB-connected phones and launches it.
#
# Run it — you are already at a PowerShell prompt, so just:
#   irm https://pp.remote365.ai/downloads/android-host/install-remote365-host.ps1 | iex
# Or from a saved copy:
#   .\install-remote365-host.ps1            (optionally  -ApkPath "C:\path\to\app-debug.apk")
#
# Requirements:
#   * Each phone: USB debugging ON (Settings > Developer options), cable connected, and the
#     "Allow USB debugging?" prompt accepted (so it shows as "device", not "unauthorized").
#   * adb: found on PATH or in common SDK spots; otherwise Google's platform-tools is downloaded
#     automatically (cached in %TEMP%\remote365-fleet, shared with uninstall-mobile-fleet.ps1).
#
# The body lives in a function and never calls `exit`: under `irm | iex` there is no script
# scope, so a bare `exit` closes the operator's console window before the error can be read.

param(
    [string]$Adb = "adb",
    [string]$ApkUrl = "https://pp.remote365.ai/downloads/android-host/remote365-host.apk",
    [string]$ApkPath = "",
    [string[]]$Only = @(),   # if set, install ONLY to these device serials
    [switch]$NoLaunch
)

function Install-Remote365Host {
    param([string]$Adb, [string]$ApkUrl, [string]$ApkPath, [string[]]$Only, [switch]$NoLaunch)

    # NOT "Stop": adb subcommands (e.g. `monkey`) print normal status to stderr, and under Stop
    # PowerShell 5.1 turns that into a terminating error that aborts the whole run after one phone.
    $ErrorActionPreference = "Continue"
    # PS 5.1: progress rendering makes large downloads crawl, and TLS 1.0 may be offered by default.
    $ProgressPreference = "SilentlyContinue"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $pkg = "ai.remote365.host"

    # Run an adb command, returning its combined stdout+stderr as one string. Never throws on stderr,
    # so a chatty subcommand can't halt the device loop.
    function Invoke-Adb { param([Parameter(ValueFromRemainingArguments = $true)] $Args)
        return (& $adbCmd @Args 2>&1 | Out-String)
    }

    # --- locate adb ------------------------------------------------------------------------------
    $adbCmd = $Adb
    if (-not (Get-Command $adbCmd -ErrorAction SilentlyContinue)) {
        foreach ($p in @(
            "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
            "D:\Android\Sdk\platform-tools\adb.exe",
            "C:\Android\Sdk\platform-tools\adb.exe",
            "$env:TEMP\remote365-fleet\platform-tools\adb.exe"
        )) { if (Test-Path $p) { $adbCmd = $p; break } }
    }
    if (-not (Get-Command $adbCmd -ErrorAction SilentlyContinue) -and -not (Test-Path $adbCmd)) {
        # A phone farm PC often has no Android SDK at all — fetch Google's platform-tools.
        $workDir = Join-Path $env:TEMP "remote365-fleet"
        if (-not (Test-Path $workDir)) { New-Item -ItemType Directory -Path $workDir -Force | Out-Null }
        $ptUrl = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
        Write-Host "adb not found. Downloading Android platform-tools from Google..." -ForegroundColor Yellow
        Write-Host "  $ptUrl" -ForegroundColor DarkGray
        $ptZip = Join-Path $workDir "platform-tools.zip"
        try {
            Invoke-WebRequest -Uri $ptUrl -OutFile $ptZip -UseBasicParsing -ErrorAction Stop
            Expand-Archive -Path $ptZip -DestinationPath $workDir -Force
            Remove-Item $ptZip -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Host "Could not download platform-tools: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Install it from https://developer.android.com/tools/releases/platform-tools, or rerun with -Adb `"C:\path\to\adb.exe`"." -ForegroundColor DarkGray
            return $false
        }
        $adbCmd = Join-Path $workDir "platform-tools\adb.exe"
        if (-not (Test-Path $adbCmd)) {
            Write-Host "platform-tools downloaded but adb.exe is missing." -ForegroundColor Red
            return $false
        }
        Write-Host "adb ready: $adbCmd" -ForegroundColor Green
    }

    # --- get the APK -----------------------------------------------------------------------------
    if (-not $ApkPath) {
        $ApkPath = Join-Path $env:TEMP "remote365-host.apk"
        Write-Host "Downloading APK from $ApkUrl ..." -ForegroundColor Cyan
        try {
            Invoke-WebRequest -Uri $ApkUrl -OutFile $ApkPath -UseBasicParsing -ErrorAction Stop
        } catch {
            Write-Host "Download failed: $_" -ForegroundColor Red
            return $false
        }
    }
    if (-not (Test-Path $ApkPath)) { Write-Host "APK not found: $ApkPath" -ForegroundColor Red; return $false }
    Write-Host ("APK: $ApkPath  (" + [math]::Round((Get-Item $ApkPath).Length / 1MB, 1) + " MB)") -ForegroundColor Green

    # --- list connected devices ------------------------------------------------------------------
    Invoke-Adb start-server | Out-Null
    $devices = (Invoke-Adb devices) -split "`r?`n" |
        Where-Object { $_ -match "\tdevice$" } |
        ForEach-Object { ($_ -split "\t")[0] }

    # -Only: restrict to the given serials, so only those phones get the app.
    if ($Only -and @($Only).Count) {
        $missing = @($Only) | Where-Object { $devices -notcontains $_ }
        if ($missing) { Write-Host ("Requested but not connected/authorised (skipped): " + ($missing -join ", ")) -ForegroundColor Yellow }
        $devices = $devices | Where-Object { $Only -contains $_ }
    }

    if (-not $devices) {
        Write-Host "No authorised devices connected." -ForegroundColor Yellow
        Write-Host "Plug in the phones, enable USB debugging, and accept the 'Allow USB debugging?' prompt." -ForegroundColor Yellow
        Write-Host (Invoke-Adb devices)
        return $false
    }
    Write-Host ("Found " + @($devices).Count + " device(s): " + ($devices -join ", ")) -ForegroundColor Green

    # --- install to each -------------------------------------------------------------------------
    $ok = 0; $fail = 0
    foreach ($d in $devices) {
        Write-Host ""
        Write-Host "== Installing to $d ==" -ForegroundColor Cyan
        # --no-streaming: some Samsung/One UI builds hang forever on adb's default streamed
        # install; the legacy push-then-install path is slower but reliable.
        $out = Invoke-Adb -s $d install --no-streaming -r $ApkPath
        if ($out -match "Success") {
            Write-Host "  installed OK" -ForegroundColor Green
            if (-not $NoLaunch) {
                Invoke-Adb -s $d shell monkey -p $pkg -c android.intent.category.LAUNCHER 1 | Out-Null
            }
            $ok++
        }
        elseif ($out -match "INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match") {
            # A differently-signed build is already installed — uninstall then reinstall.
            Write-Host "  signature mismatch with the installed copy; uninstalling old and retrying..." -ForegroundColor Yellow
            Invoke-Adb -s $d uninstall $pkg | Out-Null
            $out2 = Invoke-Adb -s $d install --no-streaming $ApkPath
            if ($out2 -match "Success") { Write-Host "  installed OK (after uninstall)" -ForegroundColor Green; $ok++ }
            else { Write-Host ("  FAILED: " + ($out2.Trim() -replace "`r?`n", " ")) -ForegroundColor Red; $fail++ }
        }
        else {
            Write-Host ("  FAILED: " + ($out.Trim() -replace "`r?`n", " ")) -ForegroundColor Red
            $fail++
        }
    }

    Write-Host ""
    Write-Host ("Done. $ok installed, $fail failed.") -ForegroundColor $(if ($fail) { "Yellow" } else { "Green" })
    return ($fail -eq 0)
}

$installOk = Install-Remote365Host -Adb $Adb -ApkUrl $ApkUrl -ApkPath $ApkPath -Only $Only -NoLaunch:$NoLaunch
# Exit codes only when running as a saved .ps1 (for automation); never under `irm | iex`.
if ($MyInvocation.MyCommand.Path -and -not $installOk) { exit 1 }
