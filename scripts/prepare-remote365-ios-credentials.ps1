param(
    [Parameter(Mandatory=$true)][string]$SourceCredentials,
    [Parameter(Mandatory=$true)][string]$ProfilePath,
    [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
$source = Get-Content -LiteralPath $SourceCredentials -Raw | ConvertFrom-Json
$certificatePath = [IO.Path]::GetFullPath((Join-Path (Split-Path $SourceCredentials) $source.ios.distributionCertificate.path))
$profilePathAbsolute = (Resolve-Path -LiteralPath $ProfilePath).Path
$certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new(
    $certificatePath, $source.ios.distributionCertificate.password,
    [Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
)
try {
    Add-Type -AssemblyName System.Security.Cryptography.Pkcs
    $cms = [Security.Cryptography.Pkcs.SignedCms]::new()
    $cms.Decode([IO.File]::ReadAllBytes($profilePathAbsolute))
    $cms.CheckSignature($true)
    [xml]$plist = [Text.Encoding]::UTF8.GetString($cms.ContentInfo.Content)
    $appId = $plist.SelectSingleNode('//key[text()="application-identifier"]/following-sibling::*[1]').InnerText
    if ($appId -ne 'TG52K552J4.com.remote365.mobile') { throw 'Profile is not for Remote365 on the Kinseb team.' }
    if ($plist.SelectSingleNode('//key[text()="ProvisionedDevices"]')) { throw 'An App Store profile is required, not Ad Hoc.' }
    if ($plist.SelectSingleNode('//key[text()="ProvisionsAllDevices"]')) { throw 'Enterprise profiles are not supported.' }
    if ($plist.SelectSingleNode('//key[text()="get-task-allow"]/following-sibling::*[1]').Name -ne 'false') { throw 'Development signing is not allowed.' }
    $expires = [datetime]::Parse($plist.SelectSingleNode('//key[text()="ExpirationDate"]/following-sibling::*[1]').InnerText)
    if ($expires -le (Get-Date) -or $certificate.NotAfter -le (Get-Date) -or -not $certificate.HasPrivateKey) { throw 'Missing private key or expired credentials.' }
    $matches = $false
    foreach ($entry in $plist.SelectNodes('//key[text()="DeveloperCertificates"]/following-sibling::array[1]/data')) {
        if ([Convert]::ToBase64String([Convert]::FromBase64String($entry.InnerText)) -eq [Convert]::ToBase64String($certificate.RawData)) { $matches = $true }
    }
    if (-not $matches) { throw 'Certificate does not match the profile.' }
    # Never emit the password to the terminal or include it in source code.
    $output = @{ ios = @{ provisioningProfilePath = $profilePathAbsolute; distributionCertificate = @{ path = $certificatePath; password = $source.ios.distributionCertificate.password } } }
    $output | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputPath -Encoding utf8
    Write-Output "Validated App Store profile for $appId; certificate and private key match."
} finally {
    $certificate.Dispose()
}
