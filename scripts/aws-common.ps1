# Funzioni condivise dagli script AWS (branch prod). Nessun segreto viene stampato.
$ErrorActionPreference = 'Stop'

function Step([string]$text) { Write-Host "`n==> $text" -ForegroundColor Cyan }

# Native tools write progress to stderr: run them without turning that into PowerShell errors.
function Invoke-Native([scriptblock]$command, [string]$failure) {
  $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { & $command 2>&1 | ForEach-Object { "$_" } | Write-Host } finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE -ne 0) { throw $failure }
}

# Runs a native tool and returns stdout; stderr is kept apart so it can be inspected without being printed.
function Get-NativeOutput([scriptblock]$command) {
  $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try {
    $errors = New-Object System.Collections.Generic.List[string]
    $out = & $command 2>&1 | ForEach-Object { if ($_ -is [System.Management.Automation.ErrorRecord]) { $errors.Add("$_") } else { "$_" } }
    return [pscustomobject]@{ Ok = ($LASTEXITCODE -eq 0); Output = ($out -join "`n"); Error = ($errors -join "`n") }
  } finally { $ErrorActionPreference = $previous }
}

function Assert-Tools([string[]]$tools) {
  foreach ($tool in $tools) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool non trovato: vedi docs/aws-setup.md §6" }
  }
}

function Assert-Identity([string]$awsProfile, [string]$region) {
  $identity = Get-NativeOutput { aws sts get-caller-identity --profile $awsProfile --region $region --output json }
  if (-not $identity.Ok) { throw "Credenziali AWS non valide per il profilo '$awsProfile'. Esegui: aws sso login --profile $awsProfile" }
  $account = ($identity.Output | ConvertFrom-Json).Account
  Write-Host "Account $account · profilo $awsProfile · regione $region"
}

function Get-StackOutputs([string]$stack, [string]$awsProfile, [string]$region) {
  $result = Get-NativeOutput { aws cloudformation describe-stacks --stack-name $stack --profile $awsProfile --region $region --query 'Stacks[0].Outputs' --output json }
  if (-not $result.Ok) { throw "Stack $stack non trovato: esegui prima scripts/deploy-aws.ps1" }
  $outputs = @{}
  foreach ($item in ($result.Output | ConvertFrom-Json)) { $outputs[$item.OutputKey] = $item.OutputValue }
  return $outputs
}

function Get-AdminKey([string]$environment, [string]$awsProfile, [string]$region) {
  $name = "/dynamolive/$environment/admin-key"
  $result = Get-NativeOutput { aws ssm get-parameter --name $name --with-decryption --profile $awsProfile --region $region --query 'Parameter.Value' --output text }
  if (-not $result.Ok) { throw "Impossibile leggere $name (esiste? permessi ssm:GetParameter?)" }
  return $result.Output.Trim()
}
