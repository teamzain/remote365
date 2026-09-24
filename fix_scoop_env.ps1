# Set correct ANDROID_HOME for Scoop
$scoopSdk = "C:\Users\PC\scoop\apps\android-clt\14742923"
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $scoopSdk, "User")

# Get current user PATH
$userPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")

# Define Scoop-specific paths
$platformTools = "$scoopSdk\platform-tools"
$emulatorPath = "$scoopSdk\emulator"

# Clean up any old paths I added earlier (the default ones)
$defaultPlatformTools = "$env:LOCALAPPDATA\Android\Sdk\platform-tools"
$defaultEmulator = "$env:LOCALAPPDATA\Android\Sdk\emulator"

$pathList = $userPath.Split(";", [System.StringSplitOptions]::RemoveEmptyEntries) | Where-Object { 
    $_ -ne $defaultPlatformTools -and $_ -ne $defaultEmulator
}

# Add new paths if not present
if ($pathList -notcontains $platformTools) { $pathList += $platformTools }
if ($pathList -notcontains $emulatorPath) { $pathList += $emulatorPath }

# Reconstruct PATH
$newPath = $pathList -join ";"
[System.Environment]::SetEnvironmentVariable("PATH", $newPath, "User")

Write-Host "ANDROID_HOME set to $scoopSdk"
Write-Host "PATH updated for Scoop."
