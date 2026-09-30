<#
.SYNOPSIS
  Quanto e costato davvero. Due fonti, con due ritardi diversi:
  1. CloudWatch (ritardo 1-3 minuti): le quantita misurate da AWS - WRU, RRU, richieste, durata Lambda.
     Sono le stesse che lo scontrino della presentazione moltiplica per il listino.
  2. Cost Explorer (ritardo 24-48 ore): la cifra che AWS fattura davvero, dopo free tier e crediti.
     Ogni chiamata a Cost Explorer costa 0,01 USD: lo script lo dice e la salta se non la chiedi.
.EXAMPLE
  ./scripts/aws-cost.ps1 -Environment live -AwsProfile live              # quantita di oggi da CloudWatch
  ./scripts/aws-cost.ps1 -Environment live -AwsProfile live -Billed      # aggiunge la fattura reale (0,01 USD)
#>
param(
  [ValidateSet('dev', 'live')][string]$Environment = 'dev',
  [Alias('Profile')][string]$AwsProfile = $Environment,
  [string]$Region = 'eu-central-1',
  [int]$Hours = 24,
  [switch]$Billed
)
. (Join-Path $PSScriptRoot 'aws-common.ps1')
Set-Location (Split-Path -Parent $PSScriptRoot)

Assert-Tools 'aws'
Assert-Identity $AwsProfile $Region
$outputs = Get-StackOutputs "dynamolive-$Environment" $AwsProfile $Region
$table = $outputs.TableName
$function = (Get-NativeOutput {
  aws cloudformation describe-stack-resource --stack-name "dynamolive-$Environment" --logical-resource-id ApiFunction `
    --profile $AwsProfile --region $Region --query 'StackResourceDetail.PhysicalResourceId' --output text
}).Output.Trim()

$to = [DateTime]::UtcNow
$from = $to.AddHours(-$Hours)
$stamp = { param($d) $d.ToString('yyyy-MM-ddTHH:mm:ssZ') }

Step "Quantita misurate da AWS (CloudWatch, ultime $Hours h)"

# Un solo GetMetricData per tutte le metriche: le dimensioni di tabella e indici sono separate e
# non vanno sommate a mano senza dirlo - qui sono righe distinte, come sullo scontrino.
$queries = @(
  @{ Id = 'wt'; Namespace = 'AWS/DynamoDB'; MetricName = 'ConsumedWriteCapacityUnits'; Dimensions = @(@{ Name = 'TableName'; Value = $table }) }
  @{ Id = 'rt'; Namespace = 'AWS/DynamoDB'; MetricName = 'ConsumedReadCapacityUnits'; Dimensions = @(@{ Name = 'TableName'; Value = $table }) }
  @{ Id = 'wbytime'; Namespace = 'AWS/DynamoDB'; MetricName = 'ConsumedWriteCapacityUnits'; Dimensions = @(@{ Name = 'TableName'; Value = $table }, @{ Name = 'GlobalSecondaryIndexName'; Value = 'ByTime' }) }
  @{ Id = 'wbyscore'; Namespace = 'AWS/DynamoDB'; MetricName = 'ConsumedWriteCapacityUnits'; Dimensions = @(@{ Name = 'TableName'; Value = $table }, @{ Name = 'GlobalSecondaryIndexName'; Value = 'ByScore' }) }
  @{ Id = 'rbyscore'; Namespace = 'AWS/DynamoDB'; MetricName = 'ConsumedReadCapacityUnits'; Dimensions = @(@{ Name = 'TableName'; Value = $table }, @{ Name = 'GlobalSecondaryIndexName'; Value = 'ByScore' }) }
  @{ Id = 'throttled'; Namespace = 'AWS/DynamoDB'; MetricName = 'ThrottledRequests'; Dimensions = @(@{ Name = 'TableName'; Value = $table }) }
  @{ Id = 'invocations'; Namespace = 'AWS/Lambda'; MetricName = 'Invocations'; Dimensions = @(@{ Name = 'FunctionName'; Value = $function }) }
  @{ Id = 'duration'; Namespace = 'AWS/Lambda'; MetricName = 'Duration'; Dimensions = @(@{ Name = 'FunctionName'; Value = $function }) }
  @{ Id = 'errors'; Namespace = 'AWS/Lambda'; MetricName = 'Errors'; Dimensions = @(@{ Name = 'FunctionName'; Value = $function }) }
)
$body = $queries | ForEach-Object {
  @{ Id = $_.Id; MetricStat = @{ Metric = @{ Namespace = $_.Namespace; MetricName = $_.MetricName; Dimensions = $_.Dimensions }; Period = 300; Stat = 'Sum' } }
}
$file = [IO.Path]::GetTempFileName()
try {
  [IO.File]::WriteAllText($file, (ConvertTo-Json @($body) -Depth 8 -Compress))
  $raw = Get-NativeOutput {
    aws cloudwatch get-metric-data --metric-data-queries "file://$file" `
      --start-time (& $stamp $from) --end-time (& $stamp $to) --scan-by TimestampAscending `
      --profile $AwsProfile --region $Region --output json
  }
  if (-not $raw.Ok) { throw "get-metric-data non riuscito: $($raw.Error)" }
  $totals = @{}
  foreach ($result in ($raw.Output | ConvertFrom-Json).MetricDataResults) {
    $sum = 0.0; foreach ($value in $result.Values) { $sum += $value }
    $totals[$result.Id] = $sum
  }
} finally { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue }

$wru = $totals['wt'] + $totals['wbytime'] + $totals['wbyscore']
$rru = $totals['rt'] + $totals['rbyscore']
# Listino Francoforte: le stesse cifre di shared/pricing.ts. Se cambi regione, cambiale in entrambi i posti.
$cost = $wru * 0.7625e-6 + $rru * 0.1525e-6 + $totals['invocations'] * (1.2e-6 + 0.2e-6) + ($totals['duration'] / 1000) * 0.25 * 0.0000133334

'{0,-34} {1,14:N1}' -f 'Scritture tabella (WRU)', $totals['wt'] | Write-Host
'{0,-34} {1,14:N1}' -f 'Scritture GSI ByTime (WRU)', $totals['wbytime'] | Write-Host
'{0,-34} {1,14:N1}' -f 'Scritture GSI ByScore (WRU)', $totals['wbyscore'] | Write-Host
'{0,-34} {1,14:N1}' -f 'Letture tabella (RRU)', $totals['rt'] | Write-Host
'{0,-34} {1,14:N1}' -f 'Letture GSI ByScore (RRU)', $totals['rbyscore'] | Write-Host
'{0,-34} {1,14:N0}' -f 'Invocazioni Lambda', $totals['invocations'] | Write-Host
'{0,-34} {1,14:N1}' -f 'Durata Lambda (s)', ($totals['duration'] / 1000) | Write-Host
'{0,-34} {1,14:N0}' -f 'Errori Lambda', $totals['errors'] | Write-Host
'{0,-34} {1,14:N0}' -f 'Richieste throttled DynamoDB', $totals['throttled'] | Write-Host
Write-Host ('{0,-34} {1,14}' -f 'STIMA A LISTINO', $cost.ToString('C4', [Globalization.CultureInfo]::GetCultureInfo('en-US'))) -ForegroundColor Green
Write-Host "Prima di free tier, crediti e imposte. Hosting (S3, CloudFront), storage e log esclusi."
if ($totals['errors'] -gt 0) { Write-Host "Ci sono stati errori Lambda: aws logs tail /aws/lambda/$function --since ${Hours}h" -ForegroundColor Yellow }
if ($totals['throttled'] -gt 0) { Write-Host 'DynamoDB ha throttlato: in live la tabella e on-demand, controlla se lo stack era dev (provisioned 5/5).' -ForegroundColor Yellow }

if (-not $Billed) {
  Write-Host "`nPer la cifra effettivamente fatturata (ritardo 24-48 h, 0,01 USD di chiamata): riesegui con -Billed" -ForegroundColor Cyan
  return
}

Step 'Costo fatturato (Cost Explorer: ritardo 24-48 h, questa chiamata costa 0,01 USD)'
$start = $from.ToString('yyyy-MM-dd'); $end = $to.AddDays(1).ToString('yyyy-MM-dd')
$billed = Get-NativeOutput {
  aws ce get-cost-and-usage --time-period "Start=$start,End=$end" --granularity DAILY --metrics UnblendedCost `
    --group-by 'Type=DIMENSION,Key=SERVICE' --profile $AwsProfile --region us-east-1 --output json
}
if (-not $billed.Ok) { throw "Cost Explorer non disponibile: $($billed.Error). Va abilitato una volta dalla console (Billing -> Cost Explorer) e i dati compaiono dopo 24 h." }
foreach ($period in ($billed.Output | ConvertFrom-Json).ResultsByTime) {
  Write-Host "`n$($period.TimePeriod.Start)"
  foreach ($group in $period.Groups) {
    $amount = [double]$group.Metrics.UnblendedCost.Amount
    if ($amount -gt 0) { '  {0,-40} {1,10:N4} {2}' -f $group.Keys[0], $amount, $group.Metrics.UnblendedCost.Unit | Write-Host }
  }
}
Write-Host "`nSe tutto e a zero: il free tier o i crediti hanno coperto il talk. E il risultato giusto, non un errore." -ForegroundColor Green
