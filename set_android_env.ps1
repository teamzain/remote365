# Set ANDROID_HOME for current user
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")

# Get current user PATH
$userPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")

# Define new paths
$platformTools = "$env:LOCALAPPDATA\Android\Sdk\platform-tools"
$emulatorPath = "$env:LOCALAPPDATA\Android\Sdk\emulator"

# Append if not already present
$newPaths = @()
if ($userPath -notlike "*$platformTools*") { $newPaths += $platformTools }
if ($userPath -notlike "*$emulatorPath*") { $newPaths += $emulatorPath }

if ($newPaths.Count -gt 0) {
    $updatedPath = $userPath + ";" + ($newPaths -join ";")
    [System.Environment]::SetEnvironmentVariable("PATH", $updatedPath, "User")
    Write-Host "PATH updated successfully."
} else {
    Write-Host "Paths already present in PATH."
}

# Move Pub Cache to F: drive to avoid "different roots" error (F: vs C:)
[System.Environment]::SetEnvironmentVariable("PUB_CACHE", "F:\.pub-cache", "User")
$env:PUB_CACHE = "F:\.pub-cache"

Write-Host "ANDROID_HOME set to $env:LOCALAPPDATA\Android\Sdk"
Write-Host "PUB_CACHE set to F:\.pub-cache (Drive F: consistency)"

# Set ANDROID_NDK_HOME
$ndkPath = "C:\Users\PC\scoop\apps\android-clt\14742923\ndk\27.0.12077973"
[System.Environment]::SetEnvironmentVariable("ANDROID_NDK_HOME", $ndkPath, "User")
$env:ANDROID_NDK_HOME = $ndkPath
Write-Host "ANDROID_NDK_HOME set to $ndkPath"
