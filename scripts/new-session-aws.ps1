<#
.SYNOPSIS
  Crea una sessione sull'API AWS, scalda la Lambda e (a richiesta) copia la chiave admin negli appunti.
.EXAMPLE
  ./scripts/new-session-aws.ps1 -Environment live -Sid talk-01
  ./scripts/new-session-aws.ps1 -Environment live -Sid talk-01 -CopyKey
#>
param(
  [ValidateSet('dev', 'live')][string]$Environment = 'dev',
  [Alias('Profile')][string]$AwsProfile = $Environment,
  [string]$Region = 'eu-central-1',
  [ValidatePattern('^[A-Za-z0-9_-]{1,48}$')][string]$Sid,
  # Durata della dissolvenza finale: su quanti secondi vengono distribuiti i TTL dei pixel nella scena di chiusura.
  [ValidateRange(5, 3600)][int]$EndTtlSeconds = 60,
  [switch]$CopyKey
)
. (Join-Path $PSScriptRoot 'aws-common.ps1')
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not $Sid -and -not $CopyKey) { throw 'Indica -Sid (crea o verifica una sessione) e/o -CopyKey' }

Assert-Tools 'aws', 'node', 'npx'
Assert-Identity $AwsProfile $Region
$outputs = Get-StackOutputs "dynamolive-$Environment" $AwsProfile $Region
$key = Get-AdminKey $Environment $AwsProfile $Region

if ($Sid) {
  Step "Sessione $Sid"
  # The key reaches the child process through its environment only, never through the command line or the console.
  $env:ADMIN_KEY = $key
  try { $result = Get-NativeOutput { npx tsx scripts/reset-session.ts --sid $Sid --api $outputs.ApiUrl --endTtlMs ($EndTtlSeconds * 1000) } }
  finally { Remove-Item Env:ADMIN_KEY -ErrorAction SilentlyContinue }
  $status = ($result.Output.Trim() -split '\s', 2)[0]
  if ($status -eq '201') { Write-Host "Sessione $Sid creata." -ForegroundColor Green }
  elseif ($status -eq '409') { Write-Host "Sessione $Sid già esistente: la uso così com'è." -ForegroundColor Yellow }
  else { throw "Creazione non riuscita: $($result.Output) $($result.Error)" }

  Step 'Riscaldamento della Lambda'
  foreach ($i in 1..3) {
    try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 "$($outputs.ApiUrl)/s/$Sid/meta"; Write-Host "meta $($r.StatusCode)" }
    catch { Write-Host "meta errore: $($_.Exception.Message)" -ForegroundColor Yellow }
  }
  Write-Host ""
  Write-Host "  LIM      $($outputs.SiteUrl)/stage?s=$Sid   (R per la regia)"
  Write-Host "  Telefono $($outputs.SiteUrl)/play?s=$Sid"
  Write-Host "  Chiusura Dissolvenza finale su $EndTtlSeconds s (si puo riavviare dalla regia)"
}

if ($CopyKey) {
  Set-Clipboard -Value $key
  Write-Host "`nChiave admin copiata negli appunti: incollala nella regia, poi copia altro per svuotare gli appunti." -ForegroundColor Green
}
$key = $null
