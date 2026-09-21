$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$localPath = Join-Path $workspacePath '.local'
$javaExe = Get-ChildItem -LiteralPath (Join-Path $localPath 'java') -Filter java.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
if (-not $javaExe) { throw 'Run scripts/setup-local-windows.ps1 first' }
$dbPath = Join-Path $localPath 'dynamodb'
New-Item -ItemType Directory -Force -Path (Join-Path $dbPath 'data') | Out-Null
Push-Location $dbPath
try { & $javaExe "-Djdk.net.unixdomain.tmpdir=$workspacePath" '-Djava.library.path=./DynamoDBLocal_lib' -jar DynamoDBLocal.jar -sharedDb -dbPath ./data -port 8000 -disableTelemetry }
finally { Pop-Location }
