#!/usr/bin/env bash
# Cloud Run へのデプロイ (Cloud Shell で実行する想定)。
#
#   1. 下の「設定値」を埋める (秘密情報はここに書かず Secret Manager に登録済みであること)
#   2. bash scripts/deploy-cloudrun.sh
#
# 初回は APP_BASE_URL が決まっていないため空のまま実行し、表示された URL を入れてもう一度実行する。
set -euo pipefail

# ===== 設定値 =====
PROJECT_ID=""               # Google Cloud のプロジェクトID
REGION="asia-northeast1"    # 東京
SERVICE="fleet-manager"
APP_BASE_URL=""             # 初回は空。2回目に https://〜.run.app を入れる
GOOGLE_SERVICE_ACCOUNT_EMAIL=""
GOOGLE_SHEETS_ID=""
GOOGLE_DRIVE_FOLDER_ID=""
ADMIN_PHONE=""
ADMIN_LINE_USER_ID=""
LIFF_ID=""
LINE_LOGIN_CHANNEL_ID=""
# Secret Manager のシークレット名
SECRETS="ADMIN_PASSWORD=admin-password:latest,GOOGLE_PRIVATE_KEY=google-private-key:latest,GEMINI_API_KEY=gemini-api-key:latest,LINE_CHANNEL_ACCESS_TOKEN=line-token:latest"
# ==================

for v in PROJECT_ID GOOGLE_SERVICE_ACCOUNT_EMAIL GOOGLE_SHEETS_ID GOOGLE_DRIVE_FOLDER_ID; do
  if [ -z "${!v}" ]; then echo "設定値 $v が空です。スクリプト冒頭を編集してください" >&2; exit 1; fi
done

# カンマを含む値に備えて区切り文字を ^@^ にする
ENV_VARS="^@^DATA_SOURCE=sheets@APP_BASE_URL=${APP_BASE_URL:-http://localhost}@GOOGLE_SERVICE_ACCOUNT_EMAIL=${GOOGLE_SERVICE_ACCOUNT_EMAIL}@GOOGLE_SHEETS_ID=${GOOGLE_SHEETS_ID}@GOOGLE_DRIVE_FOLDER_ID=${GOOGLE_DRIVE_FOLDER_ID}@ADMIN_PHONE=${ADMIN_PHONE}@ADMIN_LINE_USER_ID=${ADMIN_LINE_USER_ID}@LIFF_ID=${LIFF_ID}@LINE_LOGIN_CHANNEL_ID=${LINE_LOGIN_CHANNEL_ID}"

gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" --region "$REGION" --source . \
  --allow-unauthenticated --memory 512Mi --max-instances 3 \
  --set-env-vars "$ENV_VARS" \
  --set-secrets "$SECRETS"

URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format 'value(status.url)')
echo
echo "公開 URL: $URL"
if [ -z "$APP_BASE_URL" ]; then
  echo "→ スクリプトの APP_BASE_URL に上の URL を入れて、もう一度実行してください。"
fi
echo "→ LIFF のエンドポイント URL: $URL/liff"
