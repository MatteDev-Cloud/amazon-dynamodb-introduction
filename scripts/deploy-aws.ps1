<#
.SYNOPSIS
  Deploy completo su AWS (branch prod): segreto SSM, backend (SAM), frontend su S3 + CloudFront.
.EXAMPLE
  ./scripts/deploy-aws.ps1 -Environment dev
  ./scripts/deploy-aws.ps1 -Environment live -AwsProfile live -BudgetEmail nome@esempio.it
#>
param(
  [ValidateSet('dev', 'live')][string]$Environment = 'dev',
  [Alias('Profile')][string]$AwsProfile = $Environment,
  [string]$Region = 'eu-central-1',
  [string]$BudgetEmail = '',
  [switch]$SkipFrontend
)
. (Join-Path $PSScriptRoot 'aws-common.ps1')
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$stack = "dynamolive-$Environment"

Step 'Strumenti e credenziali'
Assert-Tools 'aws', 'sam', 'node', 'npm'
Assert-Identity $AwsProfile $Region

Step 'Chiave admin in SSM Parameter Store'
$parameter = "/dynamolive/$Environment/admin-key"
$existing = Get-NativeOutput { aws ssm get-parameter --name $parameter --profile $AwsProfile --region $Region --query 'Parameter.Name' --output text }
if ($existing.Ok) { Write-Host "$parameter presente (valore non mostrato)" }
elseif ($existing.Error -match 'ParameterNotFound') {
  # 32 random bytes, base64url: never printed, passed to the CLI through a temporary file removed right after.
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($bytes); $rng.Dispose()
  $secret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  $file = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($file, $secret)
    Invoke-Native { aws ssm put-parameter --name $parameter --type SecureString --value "file://$file" --profile $AwsProfile --region $Region --output text } 'Creazione del parametro SSM non riuscita'
  } finally { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue; $secret = $null }
  Write-Host "$parameter creato. Per leggerlo: scripts/new-session-aws.ps1 -CopyKey"
}
else { throw "Lettura di $parameter non riuscita: $($existing.Error)" }

Step 'Verifiche prima del deploy (typecheck e test: niente deploy di codice rotto)'
Invoke-Native { npm run typecheck } 'Typecheck del backend non riuscito'
Invoke-Native { npm test } 'Test del backend non superati'
Invoke-Native { npm --prefix frontend run typecheck } 'Typecheck del frontend non riuscito'
Invoke-Native { npm --prefix frontend test } 'Test del frontend non superati'

Step 'Build del backend'
Invoke-Native { npm run build:backend } 'Build del backend non riuscita'
if (-not (Test-Path (Join-Path $root 'backend/dist/handler.js'))) { throw 'backend/dist/handler.js assente: il template SAM cerca handler.handler' }

Step "sam deploy ($stack) · rivedi il change set e conferma"
$overrides = @("Environment=$Environment")
if ($BudgetEmail) { $overrides += "BudgetEmail=$BudgetEmail" }
Push-Location (Join-Path $root 'infra')
try {
  # Interactive on purpose: SAM shows the change set and waits for confirmation.
  $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  sam deploy --config-env $Environment --profile $AwsProfile --region $Region --no-fail-on-empty-changeset --parameter-overrides $overrides
  $code = $LASTEXITCODE; $ErrorActionPreference = $previous
  if ($code -ne 0) { throw 'sam deploy non riuscito o annullato' }
} finally { Pop-Location }

# «sam deploy» esce con 0 anche quando si risponde N al change set. Senza questo controllo lo script
# proseguiva a compilare e pubblicare il frontend contro uno stack che non e mai stato creato.
$status = Get-StackStatus $stack $AwsProfile $Region
if ($status -eq 'REVIEW_IN_PROGRESS') { throw "Change set non applicato (risposto N?): lo stack $stack e fermo in REVIEW_IN_PROGRESS. Rilancia e conferma con y." }
if ($status -notin @('CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE')) { throw "Lo stack $stack e in stato ${status}: controlla gli eventi in CloudFormation prima di riprovare." }

$outputs = Get-StackOutputs $stack $AwsProfile $Region -Require 'ApiUrl', 'SiteUrl', 'SiteBucketName', 'DistributionId'
if ($SkipFrontend) { Write-Host "`nBackend pronto: $($outputs.ApiUrl)"; return }

Step "Configurazione frontend (frontend/.env.$Environment, ignorato da git)"
$envFile = Join-Path $root "frontend/.env.$Environment"
$values = [ordered]@{
  VITE_API_BASE = $outputs.ApiUrl
  VITE_SESSION = $(if ($Environment -eq 'live') { 'talk-01' } else { 'prova-01' })
  VITE_PUBLIC_ORIGIN = $outputs.SiteUrl
  VITE_DOCUMENT_URL = '/dynamolive-approfondimento.pdf'
  VITE_BACKUP_URL = '/backup.mp4'
}
if (Test-Path $envFile) {
  # Keep choices already made (session, document, video); refresh only the URLs that come from the stack.
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^(VITE_[A-Z_]+)=(.*)$' -and $matches[1] -notin 'VITE_API_BASE', 'VITE_PUBLIC_ORIGIN') { $values[$matches[1]] = $matches[2] }
  }
}
$lines = @("# Generato da scripts/deploy-aws.ps1 dagli Outputs di $stack. Valori pubblici, nessun segreto.")
$lines += $values.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }
[IO.File]::WriteAllLines($envFile, [string[]]$lines, (New-Object Text.UTF8Encoding $false))
Write-Host "API  $($outputs.ApiUrl)"
Write-Host "Sito $($outputs.SiteUrl)"

Step 'Build del frontend'
Invoke-Native { npm --prefix frontend run "build:$Environment" } 'Build del frontend non riuscita'

Step 'Pubblicazione su S3 e invalidazione CloudFront'
# --delete: senza di esso un file rinominato resta servibile nel bucket e puo tornare a galla dopo un deploy.
Invoke-Native { aws s3 sync frontend/dist "s3://$($outputs.SiteBucketName)" --delete --profile $AwsProfile --region $Region --only-show-errors } 'Upload su S3 non riuscito'
Invoke-Native { aws cloudfront create-invalidation --distribution-id $outputs.DistributionId --paths '/*' --profile $AwsProfile --query 'Invalidation.Id' --output text } 'Invalidazione CloudFront non riuscita'

Step 'Controlli finali'
if (-not (Test-Path (Join-Path $root 'frontend/public/backup.mp4'))) {
  Write-Host "ATTENZIONE: frontend/public/backup.mp4 manca. Il piano B di livello 5 (video) non funzionera." -ForegroundColor Yellow
}

Write-Host "`nDeploy completato." -ForegroundColor Green
Write-Host "  Sito     $($outputs.SiteUrl)   (il primo deploy di CloudFront può richiedere 5-15 minuti)"
Write-Host "  API      $($outputs.ApiUrl)"
Write-Host "  Sessione ./scripts/new-session-aws.ps1 -Environment $Environment -AwsProfile $AwsProfile -Sid $($values.VITE_SESSION)"
