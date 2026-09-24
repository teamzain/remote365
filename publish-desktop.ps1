param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("prod", "preprod")]
    [string]$Environment
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopDir = Join-Path $repoRoot "apps\desktop"

$targets = @{
    prod = @{
        BuildScript = "build:prod"
        ReleaseDir = Join-Path $desktopDir "release45"
        ServerTarget = "root@159.65.84.190:/var/www/downloads/desktop/"
    }
    preprod = @{
        BuildScript = "build:preprod"
        ReleaseDir = Join-Path $desktopDir "release-preprod"
        ServerTarget = "root@206.189.127.215:/var/www/downloads/desktop/"
    }
}

$target = $targets[$Environment]
$releaseDir = $target.ReleaseDir
$serverTarget = $target.ServerTarget

try {
    Write-Host "Building Connect-X desktop app for $Environment..." -ForegroundColor Cyan
    Push-Location $desktopDir
    npm.cmd run $target.BuildScript

    if (-not (Test-Path $releaseDir)) {
        throw "Release folder was not created: $releaseDir"
    }

    Write-Host "Uploading desktop release files to $Environment server..." -ForegroundColor Yellow
    scp -r "$releaseDir\*" $serverTarget

    Write-Host "Done. The desktop update files are now on the $Environment server." -ForegroundColor Green
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
}
