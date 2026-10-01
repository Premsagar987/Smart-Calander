$ErrorActionPreference = 'Stop'

$projectDirectory = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$releaseDirectory = Join-Path $projectDirectory 'release-signed'
$pfxPath = (Read-Host 'Path to your trusted code-signing .pfx file').Trim('"')

if (-not (Test-Path -LiteralPath $pfxPath -PathType Leaf)) {
  throw "Certificate file not found: $pfxPath"
}

$securePassword = Read-Host 'PFX password (input is hidden)' -AsSecureString
$pfxData = Get-PfxData -FilePath $pfxPath -Password $securePassword
$certificate = $pfxData.EndEntityCertificates | Select-Object -First 1
if (-not $certificate) {
  throw 'The PFX file does not contain a signing certificate.'
}
if (-not $certificate.HasPrivateKey) {
  throw 'The signing certificate in the PFX file has no private key.'
}
if ($certificate.NotBefore -gt (Get-Date) -or $certificate.NotAfter -le (Get-Date)) {
  throw 'The signing certificate is not currently valid.'
}

$hasCodeSigningUsage = $certificate.Extensions |
  Where-Object { $_.Oid.Value -eq '2.5.29.37' } |
  ForEach-Object { $_.EnhancedKeyUsages } |
  Where-Object { $_.Value -eq '1.3.6.1.5.5.7.3.3' }
if (-not $hasCodeSigningUsage) {
  throw 'The PFX certificate is not authorized for code signing.'
}

$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:CSC_LINK = (Resolve-Path -LiteralPath $pfxPath).Path
  $env:CSC_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $env:SMART_CALENDAR_RELEASE_DIR = $releaseDirectory

  Push-Location $projectDirectory
  try {
    npm run desktop:pack
    if ($LASTEXITCODE -ne 0) {
      throw "The signed installer build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }

  $package = Get-Content -LiteralPath (Join-Path $projectDirectory 'package.json') -Raw | ConvertFrom-Json
  $installerPath = Join-Path $releaseDirectory "SmartCalendar-Setup-$($package.version).exe"
  $applicationPath = Join-Path $releaseDirectory 'win-unpacked\Smart Calendar.exe'
  foreach ($signedFile in @($applicationPath, $installerPath)) {
    $signature = Get-AuthenticodeSignature -FilePath $signedFile
    if ($signature.Status -ne 'Valid') {
      throw "Signature verification failed for '$signedFile': $($signature.StatusMessage)"
    }
  }

  $desktopDirectory = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Smart Calendar Installer'
  $desktopArchive = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Smart Calendar Installer.zip'
  $readmePath = Join-Path $desktopDirectory 'README.txt'
  if (-not (Test-Path -LiteralPath $readmePath -PathType Leaf)) {
    throw "The installer instructions were not found: $readmePath"
  }

  New-Item -ItemType Directory -Path $desktopDirectory -Force | Out-Null
  Copy-Item -LiteralPath $installerPath -Destination (Join-Path $desktopDirectory 'SmartCalendar-Setup.exe') -Force
  Compress-Archive -Path (Join-Path $desktopDirectory '*') -DestinationPath $desktopArchive -Force

  Write-Host "Signed installer created and verified: $installerPath"
  Write-Host "Signed app executable: $applicationPath"
  Write-Host "Publisher: $($signature.SignerCertificate.Subject)"
  Write-Host "Updated sharing folder: $desktopDirectory"
  Write-Host "Updated sharing archive: $desktopArchive"
} finally {
  Remove-Item Env:CSC_LINK -ErrorAction SilentlyContinue
  Remove-Item Env:CSC_KEY_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:SMART_CALENDAR_RELEASE_DIR -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $securePassword.Dispose()
}
