#!/usr/bin/env bash
# Smantella DynamoLive dall'account AWS: stack, tabella, bucket, chiave admin, bucket di SAM.
# Irreversibile: i dati della sessione e il sito pubblicato vengono cancellati.
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-live}" AWS_DEFAULT_REGION=eu-central-1 AWS_PAGER=""
ACCOUNT=975473296217
STACK=dynamolive-live
TABLE=dynamolive-live-DynamoLive
SITE_BUCKET=dynamolive-live-sitebucket-zrwqngtr48ex
SAM_STACK=aws-sam-cli-managed-default
SAM_BUCKET=aws-sam-cli-managed-default-samclisourcebucket-rfa4vnx3mnpp

step() { printf '\n==> %s\n' "$1"; }

actual=$(aws sts get-caller-identity --query Account --output text)
[ "$actual" = "$ACCOUNT" ] || { echo "Account inatteso: $actual (atteso $ACCOUNT)"; exit 1; }

# The bucket is versioned: every version and delete marker has to go before the bucket can.
empty_versions() {
  local kind objs
  for kind in Versions DeleteMarkers; do
    objs=$(aws s3api list-object-versions --bucket "$1" --query "{Objects: ${kind}[].{Key:Key,VersionId:VersionId}}" --output json)
    if echo "$objs" | grep -q VersionId; then aws s3api delete-objects --bucket "$1" --delete "$objs" >/dev/null; fi
  done
}

step "Stack $STACK (CloudFront richiede anche 10-15 minuti)"
aws cloudformation delete-stack --stack-name "$STACK"
aws cloudformation wait stack-delete-complete --stack-name "$STACK"

# Table and site bucket are DeletionPolicy: Retain, so the stack leaves them behind.
step "Tabella $TABLE"
if aws dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
  aws dynamodb delete-table --table-name "$TABLE" --query 'TableDescription.TableStatus' --output text
else echo "già eliminata"; fi

step "Bucket del sito"
if aws s3api head-bucket --bucket "$SITE_BUCKET" >/dev/null 2>&1; then
  aws s3 rb "s3://$SITE_BUCKET" --force >/dev/null
else echo "già eliminato"; fi

step "Chiave admin in SSM"
if aws ssm get-parameter --name /dynamolive/live/admin-key >/dev/null 2>&1; then
  aws ssm delete-parameter --name /dynamolive/live/admin-key
else echo "già eliminata"; fi

step "Bucket e stack di SAM"
if aws s3api head-bucket --bucket "$SAM_BUCKET" >/dev/null 2>&1; then empty_versions "$SAM_BUCKET"; fi
aws cloudformation delete-stack --stack-name "$SAM_STACK"
aws cloudformation wait stack-delete-complete --stack-name "$SAM_STACK"

step "Controllo finale"
aws cloudformation list-stacks --query "StackSummaries[?StackStatus!='DELETE_COMPLETE'].[StackName,StackStatus]" --output text
aws s3api list-buckets --query 'Buckets[].Name' --output text
aws dynamodb list-tables --query 'TableNames' --output text
echo "Fatto: se qui sopra non compare nulla, l'account è pulito."
