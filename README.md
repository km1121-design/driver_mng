# FleetManager — ドライバー・車両統合管理システム

30名規模のドライバーの個人情報・車両ステータス・各種期限（免許／車検／自賠責）を一元管理し、更新漏れをなくすためのシステムです。

| 画面 | URL | 利用者 |
| --- | --- | --- |
| ダッシュボード / ドライバー台帳 / 車両・車検管理 / 期限アラート / 車両報告 | `/`, `/drivers`, `/vehicles`, `/alerts`, `/defects` | 管理者 (PC・スマホ対応, Basic認証) |
| ドライバーポータル | `/portal?id=<portal_token>` | ドライバー (スマホ, ログイン不要) |
| LINE からの入口 | `/liff` (リッチメニューに `https://liff.line.me/<LIFF_ID>` を設定) | ドライバー (LINE ログインで本人を確認して専用ポータルへ転送) |
| 一括取り込み | `/import` | 管理者 (既存の Excel・スプレッドシートから登録・更新) |

## 構成

- **フロントエンド / API**: Next.js 16 (App Router, Server Actions) + Tailwind CSS v4
- **DB**: Google スプレッドシート (Sheets API v4 / サービスアカウント)
- **ファイル保存**: Google Drive (共有ドライブ)
- **AI OCR**: Gemini API (`/api/ocr`) — 免許証・記録事項・自賠責から有効期限を抽出
- **自動通知**: Google Apps Script (`gas/notify.gs`) + LINE Messaging API

```
src/
  app/(admin)/     管理画面 (dashboard, drivers, vehicles, alerts, defects) と Server Actions
  app/portal/      ドライバーポータル (距離・状態 / 各種提出 / 車両報告)
  app/liff/        LINE リッチメニューからの入口 (LIFF の ID トークンでドライバーを特定)
  app/(admin)/import/ 既存台帳の一括取り込み (貼り付け / CSV、プレビュー後に反映)
  app/api/ocr/     Gemini OCR API (ポータルトークンで認可)
  lib/repo/        データアクセス層 (mock / sheets を DATA_SOURCE で切替)
  lib/alerts.ts    アラート判定 (45日以内・5,000km超過・14日未報告)
  proxy.ts         管理画面の Basic 認証
gas/notify.gs      毎朝の LINE 自動通知 + line_user_id 紐付け Webhook
```

## クイックスタート (デモモード)

認証情報なしで全画面を試せます。データはメモリ上に保持され、再起動で初期化されます。

```bash
npm install
cp .env.example .env.local
npm run dev
```

- 管理画面: http://localhost:3000
- ドライバー画面: http://localhost:3000/portal?id=demo-sato （`demo-suzuki`, `demo-tanaka` も可）
- LINE からの入口: http://localhost:3000/liff （デモでは疑似ログイン。`?mock_user=U…` で別ユーザー、`&link=demo-suzuki` で紐付けを試せます）

## 本番セットアップ

1. **スプレッドシート**を作成し、ID を `GOOGLE_SHEETS_ID` に設定
2. GCP で**サービスアカウント**を作成し、Sheets API / Drive API を有効化。スプレッドシートをサービスアカウントに「編集者」で共有
3. **共有ドライブ**にフォルダを作り、サービスアカウントを「コンテンツ管理者」で追加 → フォルダ ID を `GOOGLE_DRIVE_FOLDER_ID` に設定
   （サービスアカウントはマイドライブに保存容量を持たないため共有ドライブが必須です）
   - サービスアカウントは組織外のアカウント扱いです。追加できない場合は、Workspace 管理コンソールの「共有ドライブの設定」で組織外メンバーの追加を許可するか、対象の共有ドライブだけ許可してください
4. `DATA_SOURCE=sheets` と `ADMIN_PASSWORD` を設定してデプロイ
   - シート (`drivers`, `vehicles`, `daily_reports`, `documents`, `defect_reports`, `alert_logs`) とヘッダー行は初回アクセス時に自動作成されます
5. `GEMINI_API_KEY` を設定（未設定時は OCR がデモ値を返します）
6. LINE 公式アカウントで Messaging API を有効にし、`LINE_CHANNEL_ACCESS_TOKEN` を設定（既存のアカウントをそのまま使えます）
7. リッチメニューから開けるよう LIFF を設定（下記「LINE リッチメニューとの連携」）
8. `gas/notify.gs` をスプレッドシートの Apps Script に貼り付け、冒頭コメントの手順でトリガーを設定
9. 管理画面の「一括取り込み」から既存のドライバー・車両を登録（LINE ユーザーIDの列があればそのまま取り込めます）

### LINE リッチメニューとの連携

リッチメニューのリンクは全員共通のため、LIFF で LINE ログインした本人を特定し、その人の専用ポータルへ転送します。Webhook は使わないので、既に他のツールが Webhook を使っていても共存できます。

1. LINE Developers で、公式アカウントの Messaging API チャネルと**同じプロバイダー**に「LINE ログイン」チャネルを作成
   （LINE ユーザーIDはプロバイダーごとに異なるため、別プロバイダーだと台帳の ID と一致しません）
2. 「LIFF」タブで LIFF アプリを追加: サイズ Full、エンドポイント URL `https://<公開URL>/liff`、Scope `openid`
3. チャネルを「公開済み」にする（「開発中」のままだと管理者以外はログインできません）
4. `LIFF_ID`（例: `1234567890-AbCdEfGh`）と `LINE_LOGIN_CHANNEL_ID`（チャネル基本設定のチャネルID）を設定して再デプロイ
5. リッチメニューの「車両管理」ボタンのリンクを `https://liff.line.me/<LIFF_ID>` に変更
   - `?tab=docs`・`?tab=defect` を付けると、開くタブを指定できます
   - リッチメニューを外部ツールや API で作っている場合は、そのツール側で変更してください

台帳に LINE ユーザーIDがないドライバーには、ドライバー編集画面の「LINE 登録用リンク」（`…?link=<ポータルトークン>`）を公式アカウントのチャットで送り、LINE 上で開いてもらうと自動で紐付きます。
`LIFF_ID` を設定すると、自動通知・手動通知のリンクもトークンを含まない LIFF の URL になります（GAS はスクリプト プロパティ `LIFF_ID`）。

### Cloud Run へのデプロイ

`scripts/deploy-cloudrun.sh` の冒頭の設定値を埋めて Cloud Shell で実行するのが簡単です。手動の場合:

```bash
gcloud run deploy fleet-manager \
  --source . --region asia-northeast1 --allow-unauthenticated \
  --set-env-vars DATA_SOURCE=sheets,APP_BASE_URL=https://<発行されたURL>,... \
  --set-secrets ADMIN_PASSWORD=admin-password:latest,GOOGLE_PRIVATE_KEY=google-private-key:latest,GEMINI_API_KEY=gemini-api-key:latest,LINE_CHANNEL_ACCESS_TOKEN=line-token:latest
```

秘密情報は Secret Manager に登録して `--set-secrets` で渡してください。ランニングコストの試算は [docs/cost.md](docs/cost.md) にあります。

## シート定義

指示書の定義に、運用上必要な列を追加しています（★が追加分）。

| シート | 列 |
| --- | --- |
| drivers | id, name, type, status, phone, email, ★emergency_contact_name, ★emergency_contact_phone, line_user_id, ★license_expiry, ★license_number, ★license_class, ★license_conditions, ★portal_token |
| vehicles | id, plate, car_type, usage_type, current_driver_id, status, inspection_expiry, ★insurance_expiry, current_mileage, last_oil_mileage |
| daily_reports | id, date, driver_id, vehicle_id, mileage, is_oil_changed, ★tire_ok, ★lights_brakes_ok, photo_url |
| documents | id, date, driver_id, ★vehicle_id, doc_type, file_url, parsed_expiry_date, ★uploaded_by |
| ★defect_reports | id, date, driver_id, vehicle_id, location, note, photo_urls, status |
| ★alert_logs | id, date, driver_id, kind, channel (auto / manual) |

区分値: `type` = full_commission / part_time、`status`(driver) = active / on_leave / retired、`usage_type` = fixed / shared、`status`(vehicle) = active / repair / loaner / spare / retired

## セキュリティ上の設計

- ポータル URL にはドライバー ID ではなく**推測困難な `portal_token`** を使用。漏えい時は台帳の編集画面から再発行でき、旧 URL は即無効になります
- ポータルの Server Actions / OCR API は**毎回トークンを検証**し、クライアントから driver_id を受け取りません
- LINE からの入口 (`/liff`) は LIFF の ID トークンを LINE のサーバーで検証してから、台帳の LINE ユーザーIDと照合します。LIFF 未設定のまま本番データで疑似ログインが通ることはありません
- 管理画面は Basic 認証。`ADMIN_PASSWORD` 未設定のまま本番起動すると 503 を返します

## 開発コマンド

```bash
npm run dev        # 開発サーバー
npm run build      # 本番ビルド
npm run lint       # ESLint
npm run typecheck  # TypeScript
```
