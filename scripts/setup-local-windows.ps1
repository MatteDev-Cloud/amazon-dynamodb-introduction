param([switch]$Start)
$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$localPath = Join-Path $workspacePath '.local'
New-Item -ItemType Directory -Force -Path $localPath | Out-Null
$downloads = @(
  @{Name='dynamodb'; Url='https://d1ni2b6xgvw0s0.cloudfront.net/v3.x/dynamodb_local_latest.zip'; HashUrl='https://d1ni2b6xgvw0s0.cloudfront.net/v3.x/dynamodb_local_latest.zip.sha256'},
  @{Name='java'; Url='https://corretto.aws/downloads/latest/amazon-corretto-21-x64-windows-jdk.zip'; HashUrl='https://corretto.aws/downloads/latest_sha256/amazon-corretto-21-x64-windows-jdk.zip'}
)
foreach ($download in $downloads) {
  $destination = Join-Path $localPath $download.Name
  if (-not (Test-Path -LiteralPath $destination)) {
    $archive = Join-Path $localPath ($download.Name + '.zip')
    Write-Host ('Downloading ' + $download.Name)
    if (-not (Test-Path -LiteralPath $archive)) { Invoke-WebRequest -UseBasicParsing -Uri $download.Url -OutFile $archive }
    $checksumText = (Invoke-WebRequest -UseBasicParsing -Uri $download.HashUrl).Content
    if ($checksumText -is [byte[]]) { $checksumText = [Text.Encoding]::UTF8.GetString($checksumText) }
    $expectedHash = [regex]::Match([string]$checksumText, '[a-fA-F0-9]{64}').Value
    $actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
    if (-not $expectedHash -or $actualHash -ne $expectedHash) { throw ('Checksum mismatch: ' + $download.Name) }
    Expand-Archive -LiteralPath $archive -DestinationPath $destination
    Write-Host ($download.Name + ' SHA256 ' + $actualHash)
  }
}
if ($Start) { & (Join-Path $PSScriptRoot 'start-local-db.ps1') }
