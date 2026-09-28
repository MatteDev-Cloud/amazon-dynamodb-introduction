<#
.SYNOPSIS
  Avvia la demo locale completa (branch develop): DynamoDB Local, sessione nuova, API e frontend.
.EXAMPLE
  ./scripts/demo-local.ps1
  ./scripts/demo-local.ps1 -Sid prova-02 -NoBrowser
#>
param(
  [ValidatePattern('^[A-Za-z0-9_-]{1,48}$')][string]$Sid = ('demo-' + (Get-Date -Format 'MMdd-HHmm')),
  [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step([string]$text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
# Native tools write progress to stderr: run them without turning that into PowerShell errors.
function Invoke-Native([scriptblock]$command, [string]$failure) {
  $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { & $command 2>&1 | ForEach-Object { "$_" } | Write-Host } finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE -ne 0) { throw $failure }
}
function Test-Port([int]$port) {
  $client = New-Object Net.Sockets.TcpClient
  try { return $client.ConnectAsync('127.0.0.1', $port).Wait(300) } catch { return $false } finally { $client.Dispose() }
}

Step 'Controllo strumenti'
foreach ($tool in 'node', 'npm', 'docker') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool non trovato: vedi docs/demo-guide.md" }
}
Invoke-Native { docker info --format '{{.ServerVersion}}' } 'Docker Desktop non è avviato: aprilo e riprova.'

Step 'Dipendenze'
if (-not (Test-Path node_modules)) { Invoke-Native { npm ci } 'npm ci non riuscito' }
if (-not (Test-Path frontend/node_modules)) { Invoke-Native { npm --prefix frontend ci } 'npm ci del frontend non riuscito' }

Step 'Configurazione locale (i file esistenti non vengono toccati)'
if (-not (Test-Path .env)) { Copy-Item .env.example .env; Write-Host 'creato .env da .env.example' }
if (-not (Test-Path frontend/.env.development)) { Copy-Item frontend/.env.development.example frontend/.env.development; Write-Host 'creato frontend/.env.development' }

Step 'DynamoDB Local'
Invoke-Native { docker compose up -d } 'docker compose non riuscito'
$deadline = (Get-Date).AddSeconds(30)
while (-not (Test-Port 8000)) {
  if ((Get-Date) -gt $deadline) { throw 'DynamoDB Local non risponde sulla porta 8000' }
  Start-Sleep -Milliseconds 500
}

Step "Sessione $Sid"
Invoke-Native { npm run seed -- --sid $Sid } 'Creazione della sessione non riuscita'

Step 'API e frontend'
if (Test-Port 3001) { Write-Host 'API già attiva sulla porta 3001' }
else { Start-Process powershell -WorkingDirectory $root -ArgumentList '-NoExit', '-Command', '$host.UI.RawUI.WindowTitle=''DynamoLive API''; npm run dev:api' }
if (Test-Port 5173) { Write-Host 'Frontend già attivo sulla porta 5173' }
else { Start-Process powershell -WorkingDirectory $root -ArgumentList '-NoExit', '-Command', '$host.UI.RawUI.WindowTitle=''DynamoLive frontend''; npm --prefix frontend run dev' }
$deadline = (Get-Date).AddSeconds(60)
while (-not ((Test-Port 3001) -and (Test-Port 5173))) {
  if ((Get-Date) -gt $deadline) { throw 'API o frontend non partiti: guarda le due finestre aperte' }
  Start-Sleep -Milliseconds 500
}

$stage = "http://localhost:5173/stage?s=$Sid"
Write-Host "`nPronto." -ForegroundColor Green
Write-Host "  LIM      $stage   (premi R per la regia)"
Write-Host "  Telefono http://localhost:5173/play?s=$Sid"
Write-Host "  Chiave admin: il valore di ADMIN_KEY nel file .env"
Write-Host "  Per fermare: chiudi le due finestre e 'docker compose stop'"
if (-not $NoBrowser) { Start-Process $stage }
