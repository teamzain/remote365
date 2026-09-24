# One-shot fleet provisioning for the Remote 365 Android host.
#
# Plug every phone into this PC over USB, run this once, and each device ends up:
#   installed / updated -> fully permissioned -> onboarded -> hosting -> Easy Access on,
# and you get a table of 9-digit IDs to add to your account.
#
# Safe to re-run. Devices that are already set up and hosting are left alone, so this
# doubles as a fleet repair + audit tool.
#
# Runs standalone: copy just this .ps1 to any Windows PC with the phones attached. If
# adb is missing it fetches Google's platform-tools, and if no APK is given it downloads
# the published build from the Remote 365 downloads server. Nothing else to install.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File provision-fleet.ps1
#   powershell -ExecutionPolicy Bypass -File provision-fleet.ps1 -Server prod
#   powershell -ExecutionPolicy Bypass -File provision-fleet.ps1 -Apk C:\path\app-release.apk
#   powershell -ExecutionPolicy Bypass -File provision-fleet.ps1 -SkipInstall -Sequential
#   powershell -ExecutionPolicy Bypass -File provision-fleet.ps1 -Pin 1234 -RemoveScreenLock
#
# Prerequisites: USB debugging authorised on each phone ("Always allow from this
# computer"). If the phones have a PIN/password, pass -Pin: adb cannot dismiss a secure
# keyguard by itself, and a locked screen hides the app from every UI read, which shows up
# as "ID unknown / not started". Pattern locks cannot be typed - switch them to a PIN.
#
# Note: this also turns OFF device-wide adaptive battery / app standby on each phone.
# That is deliberate on a dedicated remote-access host, but it is a global setting.

[CmdletBinding()]
param(
    # Release APK to push. When omitted the script looks for a local build, then falls
    # back to downloading the published APK from -Server.
    [string]$Apk,

    # Which published build to install when no local APK is available.
    [ValidateSet('preprod', 'prod')]
    [string]$Server = 'preprod',

    # Explicit APK URL, overriding the -Server manifest.
    [string]$ApkUrl,

    # Don't fetch Android platform-tools when adb is missing.
    [switch]$NoAdbBootstrap,

    # PIN/password used to unlock the phones. adb CANNOT dismiss a secure keyguard, and a
    # locked screen hides the app from every UI read — which looks exactly like "ID unknown
    # / not started". Assumes every phone shares this code. Pattern locks are not typeable;
    # those must be changed to a PIN or removed by hand.
    [string]$Pin,

    # With -Pin, permanently remove the screen lock (locksettings clear) so no future run
    # needs to unlock anything. Appropriate for dedicated unattended hosts; it does leave
    # the phone with no lock screen.
    [switch]$RemoveScreenLock,

    # Never uninstall to get past a blocked install. Default behaviour DOES uninstall on a
    # signing-key mismatch, because the 9-digit ID is recovered from the hardware
    # fingerprint and the fleet would otherwise stay stuck on the old build forever.
    [switch]$NoUninstall,

    # Only permission/repair the devices; don't install or update the app.
    [switch]$SkipInstall,

    # Leave the password requirement as-is instead of granting Easy Access.
    [switch]$NoEasyAccess,

    # Provision one device at a time. Slower, but the log is readable — use it when
    # a device is misbehaving and you want to watch what happens.
    [switch]$Sequential,

    # How many devices to provision at once.
    [int]$Throttle = 6,

    # Restrict to specific serials (default: every connected device).
    [string[]]$Serials
)

$ErrorActionPreference = 'Continue'
$pkg = 'ai.remote365.mobilehost'
# PowerShell 5.1 still negotiates TLS 1.0 by default, which every modern host rejects.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
# Invoke-WebRequest's progress bar makes large downloads several times slower on 5.1.
$ProgressPreference = 'SilentlyContinue'

$workDir = Join-Path $env:TEMP 'remote365-fleet'
if (-not (Test-Path $workDir)) { New-Item -ItemType Directory -Path $workDir -Force | Out-Null }

if ($Server -eq 'prod') { $baseUrl = 'https://remote365.ai' } else { $baseUrl = 'https://pp.remote365.ai' }

# ---------------------------------------------------------------- adb
# A phone farm PC often has no Android SDK at all. Rather than making that a manual
# prerequisite, fetch Google's official platform-tools into the temp dir for this run.
if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    if ($NoAdbBootstrap) {
        Write-Host "adb is not on PATH and -NoAdbBootstrap was passed. Install platform-tools first." -ForegroundColor Red
        exit 1
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

# ---------------------------------------------------------------- locate the APK
if (-not $SkipInstall) {
    # 1. an explicit local file, 2. a local build, 3. the published build.
    if (-not $Apk) {
        $repoRoot = Split-Path -Parent $PSScriptRoot
        $candidates = @(
            (Join-Path $repoRoot 'apps\mobile-native-host\android\app\build\outputs\apk\release\app-release.apk'),
            (Join-Path $repoRoot 'apps\mobile-native-host\android\app\build\outputs\apk\debug\app-debug.apk')
        )
        foreach ($candidate in $candidates) {
            if (Test-Path $candidate) { $Apk = $candidate; Write-Host "Using local build." -ForegroundColor DarkGray; break }
        }
    }

    if (-not $Apk) {
        # Nothing local: pull the published APK. Downloaded once and cached, so a fleet
        # of 40 phones doesn't re-fetch 120 MB forty times.
        if (-not $ApkUrl) {
            Write-Host "No local APK. Reading $baseUrl/downloads/mobile/latest.json ..." -ForegroundColor Yellow
            try {
                $manifest = Invoke-RestMethod -Uri "$baseUrl/downloads/mobile/latest.json?t=$(Get-Random)" -UseBasicParsing
            } catch {
                Write-Host "Could not read the update manifest: $($_.Exception.Message)" -ForegroundColor Red
                exit 1
            }
            if (-not $manifest.url) { Write-Host "Manifest has no APK url." -ForegroundColor Red; exit 1 }
            if ($manifest.url -match '^https?://') { $ApkUrl = $manifest.url } else { $ApkUrl = "$baseUrl$($manifest.url)" }
            Write-Host "Published version: $($manifest.version)" -ForegroundColor Cyan
        }

        $Apk = Join-Path $workDir ([System.IO.Path]::GetFileName(($ApkUrl -split '\?')[0]))
        $expected = 0
        if ($manifest -and $manifest.size) { $expected = [int64]$manifest.size }

        $haveIt = $false
        if (Test-Path $Apk) {
            $actual = (Get-Item $Apk).Length
            # A truncated cache file would install as a corrupt APK on every device.
            if ($expected -eq 0 -or $actual -eq $expected) { $haveIt = $true; Write-Host "Using cached APK." -ForegroundColor DarkGray }
            else { Remove-Item $Apk -Force -ErrorAction SilentlyContinue }
        }

        if (-not $haveIt) {
            Write-Host "Downloading $ApkUrl ..." -ForegroundColor Yellow
            try {
                Invoke-WebRequest -Uri $ApkUrl -OutFile $Apk -UseBasicParsing
            } catch {
                Write-Host "APK download failed: $($_.Exception.Message)" -ForegroundColor Red
                exit 1
            }
            $actual = (Get-Item $Apk).Length
            if ($expected -gt 0 -and $actual -ne $expected) {
                Write-Host "Downloaded APK is $actual bytes, expected $expected. Aborting rather than flashing a corrupt file." -ForegroundColor Red
                exit 1
            }
            Write-Host "Downloaded $([math]::Round($actual / 1MB, 1)) MB" -ForegroundColor Green
        }
    }

    if (-not $Apk -or -not (Test-Path $Apk)) {
        Write-Host "No APK available. Pass -Apk <path>, or use -SkipInstall." -ForegroundColor Red
        exit 1
    }
    Write-Host "APK: $Apk" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------- pick devices
adb start-server *> $null
$connected = (adb devices) -split "`n" |
    Where-Object { $_ -match "\tdevice\s*$" } |
    ForEach-Object { ($_ -split "\s+")[0] }

if ($Serials) { $connected = $connected | Where-Object { $Serials -contains $_ } }
if (-not $connected) {
    Write-Host "No authorised devices found. Check the USB cables and the 'Allow USB debugging' prompt on each phone." -ForegroundColor Red
    exit 1
}

Write-Host "Provisioning $($connected.Count) device(s)`n" -ForegroundColor Cyan

# ---------------------------------------------------------------- the worker
# Everything a single device needs, self-contained so it can run inside a background
# job (jobs do not inherit functions from this scope).
$worker = {
    param($serial, $pkg, $apk, $skipInstall, $easyAccess, $pin, $removeLock, $noUninstall)

    $activity = "$pkg/$pkg.MainActivity"
    $a11ySvc = "$pkg/$pkg.RemoteLinkAccessibilityService"
    $log = New-Object System.Collections.Generic.List[string]
    $row = [ordered]@{
        Serial = $serial; Model = ''; Android = ''; ID = ''
        Install = ''; Hosting = ''; Registered = ''; EasyAccess = ''; Version = ''
        AutoRestart = ''; Notes = ''
    }
    $notes = New-Object System.Collections.Generic.List[string]

    function Sh($cmd) { return (adb -s $serial shell $cmd 2>$null) -join "`n" }
    function Prop($name) { return (Sh "getprop $name").Trim() }

    # Pull the real reason out of adb's output. adb prints the useful part as
    # "Failure [INSTALL_FAILED_...]" and otherwise buries it in a stack trace.
    function Get-InstallError($out) {
        $m = [regex]::Match($out, 'Failure \[([^\]]+)\]')
        if ($m.Success) { return $m.Groups[1].Value }
        $m = [regex]::Match($out, 'INSTALL_FAILED_\w+')
        if ($m.Success) { return $m.Value }
        $m = [regex]::Match($out, 'adb: (.+)')
        if ($m.Success) { return $m.Groups[1].Value.Trim() }
        $last = ($out -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 1)
        if ($last) { return $last.Trim() }
        return 'unknown error'
    }

    function Test-Hosting {
        $svc = Sh "dumpsys activity services $pkg"
        return ($svc -match 'BackgroundService' -or $svc -match 'MediaProjectionService')
    }

    function Test-Keyguard {
        $w = Sh 'dumpsys window'
        if ($w -match 'mDreamingLockscreen=true') { return $true }
        return ((Sh 'dumpsys activity activities') -match 'KeyguardController:[\s\S]{0,200}?[Ss]howing=true')
    }

    # `wm dismiss-keyguard` clears a swipe lock but is powerless against a PIN/pattern —
    # the app then never reaches the foreground and every UI read returns the lock screen.
    # With a PIN supplied we type it in, which is the only way to automate a secure phone.
    function Wake-Device {
        adb -s $serial shell input keyevent KEYCODE_WAKEUP *> $null
        adb -s $serial shell wm dismiss-keyguard *> $null
        if (-not $pin) { return }
        Start-Sleep -Milliseconds 700
        if (-not (Test-Keyguard)) { return }

        # Swipe up to raise the PIN pad, sized from the real panel rather than guessed.
        $w = 1080; $h = 2340
        $m = [regex]::Match((Sh 'wm size'), '(\d+)x(\d+)')
        if ($m.Success) { $w = [int]$m.Groups[1].Value; $h = [int]$m.Groups[2].Value }
        adb -s $serial shell input swipe $([int]($w / 2)) $([int]($h * 0.75)) $([int]($w / 2)) $([int]($h * 0.2)) 200 *> $null
        Start-Sleep -Milliseconds 900
        adb -s $serial shell input text $pin *> $null
        adb -s $serial shell input keyevent KEYCODE_ENTER *> $null
        Start-Sleep -Seconds 2
    }

    # A dump only "fails" loudly when uiautomator itself errors. The far more common — and
    # completely silent — failure is a dump that succeeds against the WRONG screen: with the
    # display asleep it returns the lock screen / always-on clock, which parses fine and
    # contains none of our text. That is what made healthy devices report "ID unknown" and
    # "not started". So: if our package isn't in the dump, wake up and try again.
    function Get-Ui {
        param([switch]$AnyScreen)
        for ($i = 0; $i -lt 4; $i++) {
            adb -s $serial shell uiautomator dump /sdcard/r365.xml *> $null
            $xml = Sh "cat /sdcard/r365.xml"
            if ($xml -and $xml.Contains('<hierarchy')) {
                if ($AnyScreen -or $xml -match [regex]::Escape($pkg)) { return $xml }
                # Right dump, wrong screen — the phone dozed off. Wake and re-front the app.
                Wake-Device
                adb -s $serial shell am start -n $activity *> $null
                Start-Sleep -Seconds 3
                continue
            }
            Start-Sleep -Milliseconds 700
        }
        # Hand back whatever we last saw so the caller can report what was on screen.
        if ($xml -and $xml.Contains('<hierarchy')) { return $xml }
        return $null
    }

    function Tap-Text($xml, $pattern) {
        $rx = [regex]('<node[^>]*?text="(' + $pattern + ')"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
        $m = $rx.Match($xml)
        if (-not $m.Success) { return $false }
        $x = [int](([int]$m.Groups[2].Value + [int]$m.Groups[4].Value) / 2)
        $y = [int](([int]$m.Groups[3].Value + [int]$m.Groups[5].Value) / 2)
        adb -s $serial shell input tap $x $y *> $null
        return $true
    }

    # Read the ID off the Host Access screen, where it is displayed as "106 897 857".
    # This is the reliable source: the log only ever prints the ID as part of a signaling
    # register, so a device that finished setup but has not gone online yet has a perfectly
    # good ID that never appears in logcat.
    function Get-HostIdFromUi($xml) {
        if (-not $xml) { return $null }
        $m = [regex]::Match($xml, 'text="(\d{3}\s?\d{3}\s?\d{3})"')
        if ($m.Success) { return ($m.Groups[1].Value -replace '\s', '') }
        return $null
    }

    function Get-HostIdFromLog {
        $lines = (adb -s $serial logcat -d -s ReactNativeJS:V 2>$null) -join "`n"
        $m = [regex]::Matches($lines, 'RemoteLinkHost\].*?(?:accessKey|sessionId)"\s*:\s*"(\d{4,})"')
        if ($m.Count -gt 0) { return $m[$m.Count - 1].Groups[1].Value }
        # Fall back to the full buffer; some OEM logcats do not honour the tag filter.
        $all = (adb -s $serial logcat -d 2>$null) -join "`n"
        $m2 = [regex]::Matches($all, 'RemoteLinkHost\].*?(?:accessKey|sessionId)"\s*:\s*"(\d{4,})"')
        if ($m2.Count -gt 0) { return $m2[$m2.Count - 1].Groups[1].Value }
        return $null
    }

    # What the phone can actually see, so "no ID" can be told apart from "no internet".
    function Test-DeviceOnline {
        $r = Sh 'ping -c 1 -W 3 8.8.8.8'
        return ($r -match '1 (packets )?received' -or $r -match ' 0% packet loss')
    }

    # The Host Access screen prints the live signaling state as "Online" / "Offline", which
    # is the app's own view of whether the BACKEND has confirmed it. Prefer that over the
    # log: this script clears logcat when it restarts an idle device, so grepping for
    # `signaling:registered` reported "no" for a device that was demonstrably online.
    function Test-RegisteredFromUi($xml) {
        if (-not $xml) { return $null }
        if ($xml -match 'text="Online"') { return $true }
        if ($xml -match 'text="Offline"') { return $false }
        return $null
    }

    function Test-RegisteredFromLog {
        $all = (adb -s $serial logcat -d 2>$null) -join "`n"
        return ($all -match 'signaling:registered')
    }

    $row.Model = Prop 'ro.product.model'
    $row.Android = Prop 'ro.build.version.release'
    $manufacturer = (Prop 'ro.product.manufacturer').ToLower()

    # Keep the display on for as long as the phone is plugged in. Without this the screen
    # times out (30s on Samsung) part-way through the install-and-onboard sequence, and every
    # subsequent UI read silently returns the lock screen instead of the app. These are
    # permanently USB-attached hosts, so this is the right setting to leave behind.
    adb -s $serial shell svc power stayon usb *> $null
    Wake-Device

    # ---- 1. install / update -------------------------------------------------
    $wasHosting = Test-Hosting
    if (-not $skipInstall) {
        $out = (adb -s $serial install -r -d "$apk" 2>&1) -join "`n"

        if ($out -notmatch 'Success') {
            $err = Get-InstallError $out
            # A different signing key on the installed build is the usual blocker on a fleet
            # that was first flashed with a debug APK. Reinstalling is safe here: the backend
            # re-derives the SAME 9-digit ID from the hardware fingerprint, so the device
            # keeps its identity. Previously this was only reported, which left the whole
            # fleet stuck on the old build with nothing acting on it.
            if ($err -match 'UPDATE_INCOMPATIBLE|signatures do not match|VERSION_DOWNGRADE|ALREADY_EXISTS') {
                if ($noUninstall) {
                    $log.Add("  $err (uninstall disabled)")
                } else {
                    $log.Add("  $err -> uninstalling and reinstalling (ID is preserved)")
                    adb -s $serial uninstall $pkg *> $null
                    Start-Sleep -Seconds 2
                    $out = (adb -s $serial install -r -d "$apk" 2>&1) -join "`n"
                }
            }
        }

        if ($out -match 'Success') {
            $row.Install = 'ok'
            $log.Add("  installed/updated")
        } else {
            $err = Get-InstallError $out
            $row.Install = $err
            # Say exactly what adb said, plus what to do about it. "install failed" on its
            # own told nobody anything.
            $hint = ''
            if ($err -match 'INSUFFICIENT_STORAGE') { $hint = ' - free up space on the phone' }
            elseif ($err -match 'USER_RESTRICTED') { $hint = ' - enable "Install via USB" in Developer options (MIUI/Realme)' }
            elseif ($err -match 'UPDATE_INCOMPATIBLE|signatures do not match') { $hint = ' - uninstall Remote 365 on the phone, then re-run' }
            elseif ($err -match 'no devices|device offline|unauthorized') { $hint = ' - re-plug the cable and accept the USB debugging prompt' }
            elseif ($err -match 'INSTALL_FAILED_TEST_ONLY') { $hint = ' - this APK is debug/test-only; build a release APK' }
            $notes.Add("INSTALL FAILED: $err$hint")
        }

        # The installer force-stops the app. With the MY_PACKAGE_REPLACED receiver the host
        # is supposed to come back on its own, with nobody touching the phone -- verify it,
        # since silently failing here is precisely the bug this release fixes.
        if ($wasHosting) {
            $back = $false
            for ($i = 0; $i -lt 12; $i++) {
                Start-Sleep -Seconds 1
                if (Test-Hosting) { $back = $true; break }
            }
            if ($back) { $row.AutoRestart = 'yes'; $log.Add("  auto-restarted after update") }
            else { $row.AutoRestart = 'NO'; $notes.Add('did not self-restart after update') }
        } else {
            $row.AutoRestart = 'n/a'
        }
    }

    $verMatch = [regex]::Match((Sh "dumpsys package $pkg"), 'versionName=(\S+)')
    if ($verMatch.Success) { $row.Version = $verMatch.Groups[1].Value }
    if (-not $row.Version) {
        $notes.Add('app not installed')
        $row.Notes = ($notes -join '; ')
        return [pscustomobject]@{ Row = [pscustomobject]$row; Log = $log }
    }

    # ---- 2. every permission that adb can grant ------------------------------
    $granted = New-Object System.Collections.Generic.List[string]

    # Grant (or RE-grant) the accessibility service. Factored into a function because a
    # single early grant is not durable: on Samsung the service was verified enabled here
    # and had silently vanished from the list minutes later — opening Settings >
    # Accessibility during the onboarding walk sanitises services that the user never
    # toggled by hand. The onboarding loop below therefore calls this again, otherwise
    # "Enable Accessibility" just bounces to Settings forever and the phone strands on
    # step 1 of 4 ("no Start Hosting button on screen", "ID unreadable").
    function Ensure-A11y {
        # Android 13+ marks sideloaded apps and BLOCKS their accessibility toggle behind
        # "Restricted setting". Clearing the appop first is what makes the adb grant stick.
        # (Verified on a real device: the op showed `default; rejectTime=+9m ago`.)
        adb -s $serial shell appops set $pkg ACCESS_RESTRICTED_SETTINGS allow *> $null
        $cur = (Sh 'settings get secure enabled_accessibility_services').Trim()
        if ($cur -like "*$pkg*") { return $true }
        # Append rather than replace, so other services (TeamViewer, Samsung) survive.
        if ($cur -eq 'null' -or $cur -eq '') { $new = $a11ySvc } else { $new = "$cur`:$a11ySvc" }
        for ($try = 0; $try -lt 2; $try++) {
            adb -s $serial shell settings put secure enabled_accessibility_services "$new" *> $null
            adb -s $serial shell settings put secure accessibility_enabled 1 *> $null
            Start-Sleep -Seconds 1
            # Verify rather than assume. A silently rejected write is exactly how a phone
            # ends up demanding the manual walk while being reported as granted.
            if ((Sh 'settings get secure enabled_accessibility_services') -like "*$pkg*") { return $true }
        }
        return $false
    }

    if (Ensure-A11y) {
        $granted.Add('accessibility')
    } else {
        $notes.Add('ACCESSIBILITY GRANT REJECTED - enable it by hand: Settings > Accessibility > Installed apps > Remote 365 > On > Allow')
    }

    if ((Sh "appops get $pkg SYSTEM_ALERT_WINDOW") -notmatch 'allow') {
        adb -s $serial shell appops set $pkg SYSTEM_ALERT_WINDOW allow *> $null
        $granted.Add('overlay')
    }

    if (-not ((Sh 'dumpsys deviceidle whitelist') -match [regex]::Escape($pkg))) {
        adb -s $serial shell dumpsys deviceidle whitelist +$pkg *> $null
        $granted.Add('battery')
    }

    adb -s $serial shell pm grant $pkg android.permission.POST_NOTIFICATIONS *> $null

    # Lets the app install its OWN updates later, so a remote phone never needs a USB cable
    # again. Without it the self-updater downloads the APK and then stalls on a settings screen.
    if ((Sh "appops get $pkg REQUEST_INSTALL_PACKAGES") -notmatch 'allow') {
        adb -s $serial shell appops set $pkg REQUEST_INSTALL_PACKAGES allow *> $null
        $granted.Add('self-update')
    }

    # Keep the app out of the throttled standby buckets and let it run in the background.
    adb -s $serial shell cmd appops set $pkg RUN_IN_BACKGROUND allow *> $null
    adb -s $serial shell cmd appops set $pkg RUN_ANY_IN_BACKGROUND allow *> $null
    adb -s $serial shell cmd appops set $pkg START_FOREGROUND allow *> $null
    adb -s $serial shell cmd package set-standby-bucket $pkg active *> $null

    # Device-wide battery learning, on a phone whose whole job is to stay reachable. Both
    # of these put "unused" apps to sleep on their own schedule and will silently undo the
    # per-app exemptions above after a few idle days.
    adb -s $serial shell settings put global app_standby_enabled 0 *> $null
    adb -s $serial shell settings put global adaptive_battery_management_enabled 0 *> $null

    if ($granted.Count) { $log.Add("  granted: $($granted -join ', ')") }

    # OEM power managers are not reachable over adb and will kill the app regardless of
    # everything above. Flag them so they can be handled once, by hand, per device.
    if ($manufacturer -match 'xiaomi|redmi|poco|oppo|realme|vivo|huawei|honor|oneplus|tecno|infinix') {
        $notes.Add("enable Autostart for Remote 365 in the $manufacturer battery settings")
    }
    if ($manufacturer -match 'samsung') {
        # The single most common cause of a Samsung host quietly going offline for good.
        $notes.Add('Samsung: turn off Battery > Background usage limits > "Put unused apps to sleep"')
    }

    # ---- 3. wake, launch, walk any remaining onboarding ----------------------
    Wake-Device
    Start-Sleep -Seconds 1
    if (Test-Keyguard) {
        Wake-Device
        Start-Sleep -Seconds 2
    }
    $locked = Test-Keyguard
    if (-not $locked -and $pin -and $removeLock) {
        # Clear the lock for good, so no later run has to type anything.
        $out = (adb -s $serial shell locksettings clear --old $pin 2>&1) -join ' '
        if ($out -match 'success' -or (Sh 'locksettings get-disabled').Trim() -eq 'true') {
            $log.Add("  screen lock removed")
        } else {
            $notes.Add('could not remove the screen lock - check the PIN')
        }
    }
    if ($locked) {
        if ($pin) { $notes.Add('LOCKED - the PIN did not unlock it (pattern locks cannot be typed)') }
        else { $notes.Add('LOCKED - re-run with -Pin <code>, or remove the screen lock on this phone') }
    }
    if (-not (Test-Hosting)) {
        adb -s $serial logcat -c *> $null
        adb -s $serial shell am force-stop $pkg *> $null
        Start-Sleep -Milliseconds 800
    }
    adb -s $serial shell am start -n $activity *> $null

    # A first launch on a budget phone loads a ~120 MB RN bundle, shows a 1.4s splash and
    # makes a network call before it renders anything tappable — and six devices are doing
    # it at once. Poll for a real screen instead of guessing a fixed sleep.
    $xml = $null
    for ($w = 0; $w -lt 15; $w++) {
        Start-Sleep -Seconds 2
        $xml = Get-Ui
        if ($xml -and ($xml -match 'Your ID' -or $xml -match 'Start Hosting' -or $xml -match 'Stop Hosting' -or
                       $xml -match 'Enable Accessibility' -or $xml -match 'Start Using App')) { break }
    }

    $lastScreen = ''
    for ($step = 0; $step -lt 12; $step++) {
        $xml = Get-Ui
        if (-not $xml) { break }
        if ($xml -match 'Your ID' -or $xml -match 'Start Hosting' -or $xml -match 'Stop Hosting') { break }

        # A blocking Alert (e.g. "Setup failed") swallows every later tap, so clear it first
        # and remember what it said — that message is usually the whole explanation.
        if ($xml -match 'Setup failed' -or $xml -match 'Host setup failed' -or $xml -match 'Setup incomplete') {
            $alertBody = [regex]::Match($xml, 'text="([^"]{20,160})"')
            if ($alertBody.Success) { $notes.Add("app alert: $($alertBody.Groups[1].Value)") }
        }
        if (Tap-Text $xml 'OK|Got it|Dismiss') { Start-Sleep -Seconds 2; continue }

        # The accessibility step only advances when the app SEES the service enabled; if
        # the grant was reverted (see Ensure-A11y) the tap just opens Settings and the walk
        # loops until it gives up. Re-assert it immediately before tapping.
        if ($xml -match 'Enable Accessibility') {
            if ((Ensure-A11y) -and -not $granted.Contains('accessibility')) { $granted.Add('accessibility') }
        }

        # Tap the step's primary action; never "Skip Setup", which abandons setup.
        # "Start Using App" is the success screen shown after the four permission slides —
        # leaving it out stranded every fresh device there, short of the Host Access screen.
        $acted = Tap-Text $xml 'Enable Accessibility|Allow Notifications|Allow Overlay|Disable Battery Optimization|Start Using App|Continue|Get Started|Finish'
        if (-not $acted) {
            # Nothing recognised: record what IS on screen so the next run explains itself
            # instead of just reporting "not started" again.
            $seen = [regex]::Matches($xml, 'text="([^"]{3,40})"') | ForEach-Object { $_.Groups[1].Value }
            $lastScreen = (($seen | Select-Object -Unique -First 6) -join ' | ')
            break
        }
        Start-Sleep -Seconds 3
        # Some steps bounce out to a system settings page; come back.
        if ((Sh 'dumpsys window') -notmatch [regex]::Escape($pkg)) {
            adb -s $serial shell input keyevent KEYCODE_BACK *> $null
            Start-Sleep -Seconds 2
            adb -s $serial shell am start -n $activity *> $null
            Start-Sleep -Seconds 3
        }
    }

    # ---- 4. start hosting ----------------------------------------------------
    # Drive this off the app's OWN screen, never off the service list. A BackgroundService
    # record lingers after the host has dropped offline, so "is the service running" reports
    # a happily hosting device when the app is actually sitting on Offline / Start Hosting —
    # and because that looked like success, the script skipped the tap and left it offline.
    $xml = Get-Ui
    if ($xml -and $xml -match 'text="Stop Hosting"') {
        $row.Hosting = 'online'
    } elseif ($xml -and (Tap-Text $xml 'Start Hosting')) {
        $row.Hosting = 'not confirmed'
        for ($w = 0; $w -lt 10; $w++) {
            Start-Sleep -Seconds 2
            $after = Get-Ui
            if ($after -and $after -match 'text="Stop Hosting"') { $row.Hosting = 'started'; break }
        }
        if ($row.Hosting -ne 'started') { $notes.Add('tapped Start Hosting but the app did not go online') }
    } else {
        $row.Hosting = 'not started'
        if ($lastScreen) { $notes.Add("stuck on: $lastScreen") }
        elseif (-not $xml) { $notes.Add('could not read the screen') }
        else { $notes.Add('no Start Hosting button on screen') }
        if (-not (Test-DeviceOnline)) { $notes.Add('NO INTERNET on this phone - it cannot register') }
    }

    # ---- 5. Easy Access ------------------------------------------------------
    # The Host Access screen has exactly one Switch, so `checked` on it is unambiguous.
    if ($easyAccess) {
        $xml = Get-Ui
        if ($xml -and $xml -match 'Grant easy access') {
            $sw = [regex]::Match($xml, '<node[^>]*?class="android\.widget\.Switch"[^>]*?>')
            if ($sw.Success) {
                $isOn = $sw.Value -match 'checked="true"'
                if ($isOn) {
                    $row.EasyAccess = 'already on'
                } else {
                    $b = [regex]::Match($sw.Value, 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
                    if ($b.Success) {
                        $x = [int](([int]$b.Groups[1].Value + [int]$b.Groups[3].Value) / 2)
                        $y = [int](([int]$b.Groups[2].Value + [int]$b.Groups[4].Value) / 2)
                        adb -s $serial shell input tap $x $y *> $null
                        Start-Sleep -Seconds 3
                        $after = Get-Ui
                        $sw2 = [regex]::Match("$after", '<node[^>]*?class="android\.widget\.Switch"[^>]*?>')
                        if ($sw2.Success -and $sw2.Value -match 'checked="true"') { $row.EasyAccess = 'enabled' }
                        else { $row.EasyAccess = 'tap not confirmed'; $notes.Add('verify Easy Access on screen') }
                    }
                }
            } else {
                $row.EasyAccess = 'switch not found'
            }
        } else {
            $row.EasyAccess = 'screen not reached'
        }
    } else {
        $row.EasyAccess = 'skipped'
    }

    # ---- 6. identity + proof it is really online -----------------------------
    # Screen first (present as soon as the device has registered, online or not),
    # then the log as a fallback for a device sitting on some other screen.
    for ($w = 0; $w -lt 8; $w++) {
        $id = Get-HostIdFromUi (Get-Ui)
        if (-not $id) { $id = Get-HostIdFromLog }
        if ($id) { $row.ID = $id; break }
        Start-Sleep -Seconds 2
    }
    if (-not $row.ID) {
        $row.ID = 'unknown'
        if (-not (Test-DeviceOnline)) { $notes.Add('NO INTERNET on this phone - it cannot register') }
        else { $notes.Add('ID unreadable - check the screen is unlocked') }
    }

    # Registering takes a moment after the service starts, so give it time rather than
    # taking the first reading as final.
    $registered = $null
    for ($w = 0; $w -lt 12; $w++) {
        $registered = Test-RegisteredFromUi (Get-Ui)
        if ($registered -eq $true) { break }
        if (Test-RegisteredFromLog) { $registered = $true; break }
        Start-Sleep -Seconds 2
    }
    if ($registered -eq $true) {
        $row.Registered = 'yes'
    } else {
        $row.Registered = 'no'
        # Don't blame the backend for something the lock screen caused — that note sent us
        # chasing network problems on phones that were simply never visible to the script.
        if ($locked) { }
        elseif (-not (Test-DeviceOnline)) { $notes.Add('NO INTERNET on this phone - it cannot register') }
        else { $notes.Add('app is not reporting Online - check the backend is reachable') }
    }

    adb -s $serial shell rm -f /sdcard/r365.xml *> $null
    $row.Notes = ($notes -join '; ')
    return [pscustomobject]@{ Row = [pscustomobject]$row; Log = $log }
}

# ---------------------------------------------------------------- run it
$results = @()

if ($Sequential -or $connected.Count -eq 1) {
    foreach ($s in $connected) {
        Write-Host "=== $s ===" -ForegroundColor Yellow
        $r = & $worker $s $pkg $Apk $SkipInstall.IsPresent (-not $NoEasyAccess.IsPresent) $Pin $RemoveScreenLock.IsPresent $NoUninstall.IsPresent
        $r.Log | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray }
        $results += $r.Row
    }
} else {
    $jobs = @()
    $queue = New-Object System.Collections.Queue
    $connected | ForEach-Object { $queue.Enqueue($_) }

    while ($queue.Count -gt 0 -or $jobs.Count -gt 0) {
        while ($queue.Count -gt 0 -and $jobs.Count -lt $Throttle) {
            $s = $queue.Dequeue()
            Write-Host "start  $s" -ForegroundColor DarkGray
            $jobs += Start-Job -ScriptBlock $worker -ArgumentList $s, $pkg, $Apk, $SkipInstall.IsPresent, (-not $NoEasyAccess.IsPresent), $Pin, $RemoveScreenLock.IsPresent, $NoUninstall.IsPresent
        }
        Start-Sleep -Seconds 2
        $done = $jobs | Where-Object { $_.State -ne 'Running' }
        foreach ($j in $done) {
            $r = Receive-Job $j -ErrorAction SilentlyContinue
            Remove-Job $j -Force -ErrorAction SilentlyContinue
            if ($r -and $r.Row) {
                $ok = ($r.Row.ID -ne 'unknown' -and $r.Row.Registered -eq 'yes')
                if ($ok) { $colour = 'Green' } else { $colour = 'Yellow' }
                Write-Host "done   $($r.Row.Serial)  ID=$($r.Row.ID)  $($r.Row.Hosting)" -ForegroundColor $colour
                # Surface the reason immediately; waiting for the summary table made every
                # failure look identical and unexplained.
                if ($r.Row.Notes) { Write-Host "       -> $($r.Row.Notes)" -ForegroundColor DarkYellow }
                $results += $r.Row
            }
        }
        $jobs = @($jobs | Where-Object { $_.State -eq 'Running' })
    }
}

# ---------------------------------------------------------------- report
Write-Host "`n================ FLEET ================" -ForegroundColor Cyan
$results | Format-Table Serial, Model, Android, ID, Install, Hosting, Registered, EasyAccess, Version, AutoRestart -AutoSize

$problems = $results | Where-Object { $_.Notes }
if ($problems) {
    Write-Host "--- needs attention ---" -ForegroundColor Yellow
    $problems | ForEach-Object { Write-Host ("  {0} ({1}): {2}" -f $_.Serial, $_.Model, $_.Notes) -ForegroundColor Yellow }
}

$ready = @($results | Where-Object { $_.Registered -eq 'yes' -and $_.ID -ne 'unknown' })
Write-Host "`n$($ready.Count)/$($results.Count) device(s) online and ready to add to your account." -ForegroundColor Cyan
if ($ready.Count) {
    Write-Host "IDs: $(($ready | ForEach-Object { $_.ID }) -join ', ')" -ForegroundColor Green
}

$csv = Join-Path $env:USERPROFILE 'remote365-fleet.csv'
$results | Export-Csv -NoTypeInformation -Path $csv
Write-Host "Saved to $csv" -ForegroundColor DarkGray
