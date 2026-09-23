/**
 * FleetManager 自動通知スクリプト (Google Apps Script)
 *
 * 設置方法:
 *   1. DB 用スプレッドシートで「拡張機能 > Apps Script」を開き、このファイルを貼り付ける
 *   2. 「プロジェクトの設定 > スクリプト プロパティ」に以下を登録
 *        LINE_CHANNEL_ACCESS_TOKEN : LINE Messaging API のチャネルアクセストークン
 *        APP_BASE_URL              : Next.js アプリの URL (例: https://fleet.example.com)
 *        LIFF_ID                   : (任意) 設定すると通知のリンクを LIFF の URL にする
 *                                    (LINE ログインで本人確認するため、URL にトークンを載せない)
 *   3. setupTrigger() を一度だけ手動実行 → 毎朝 8 時台に dailyNotify() が動く
 *   4. (任意・通常は不要) ウェブアプリとしてデプロイし、その URL を LINE の Webhook URL に設定すると
 *      「登録:<ポータルトークン>」メッセージで line_user_id を自動紐付けできる。
 *      LIFF の「LINE 登録用リンク」で紐付けられるため、LIFF を使う場合は設定しなくてよい。
 *      他のツールが Webhook を使っている場合は、上書きするとそのツールが止まるので設定しないこと。
 *
 * しきい値は src/lib/config.ts の THRESHOLDS と揃えること。
 */

var THRESHOLDS = {
  expiryWarnDays: 45,
  oilChangeKm: 5000,
  unreportedDays: 14,
};
/** 期限系はこの残日数の日だけ通知 (期限切れ後は毎日) */
var EXPIRY_NOTIFY_DAYS = [45, 30, 14, 7, 3, 1, 0];
/** オイル・未報告は前回自動通知からこの日数あける */
var REPEAT_INTERVAL_DAYS = 3;

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "dailyNotify") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("dailyNotify").timeBased().atHour(8).everyDays(1).inTimezone("Asia/Tokyo").create();
}

// ---------- シート操作 ----------

function readTable_(name) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) return [];
  var values = sheet.getDataRange().getDisplayValues();
  var header = values.shift() || [];
  return values
    .filter(function (r) { return r[0] !== ""; })
    .map(function (r) {
      var o = {};
      header.forEach(function (h, i) { o[h] = /_expiry$/.test(h) ? normalizeYmd_(r[i]) : r[i]; });
      return o;
    });
}

function appendLog_(driverId, kind) {
  var sheet = SpreadsheetApp.getActive().getSheetByName("alert_logs");
  if (!sheet) return;
  sheet.appendRow(["log_" + Utilities.getUuid().replace(/-/g, "").slice(0, 12), new Date().toISOString(), driverId, kind, "auto"]);
}

// ---------- 日付 ----------

function todayJst_() {
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
}

function daysBetween_(fromYmd, toYmd) {
  return Math.round((Date.parse(toYmd + "T00:00:00Z") - Date.parse(fromYmd + "T00:00:00Z")) / 86400000);
}

function isYmd_(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** 手入力で「2026/5/1」形式になった日付も YYYY-MM-DD に揃える */
function normalizeYmd_(v) {
  var m = String(v).trim().match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  return m ? m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2) : String(v).trim();
}

// ---------- 本体 ----------

function dailyNotify() {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty("APP_BASE_URL");
  var liffId = props.getProperty("LIFF_ID");
  var today = todayJst_();

  var drivers = readTable_("drivers").filter(function (d) { return d.status === "active"; });
  var vehicles = readTable_("vehicles").filter(function (v) { return v.status !== "retired"; });
  var reports = readTable_("daily_reports");
  var logs = readTable_("alert_logs");

  function lastAutoDays(driverId, kind) {
    var last = logs
      .filter(function (l) { return l.driver_id === driverId && l.kind === kind && l.channel === "auto"; })
      .map(function (l) { return l.date; })
      .sort()
      .pop();
    return last ? daysBetween_(Utilities.formatDate(new Date(last), "Asia/Tokyo", "yyyy-MM-dd"), today) : Infinity;
  }
  function shouldNotifyExpiry(days) {
    return days < 0 || EXPIRY_NOTIFY_DAYS.indexOf(days) >= 0;
  }
  function url(driver, path) {
    // src/lib/config.ts の driverLink と同じ規則
    if (liffId) return "https://liff.line.me/" + liffId + (path ? "?" + path.slice(1) : "");
    return baseUrl + "/portal?id=" + encodeURIComponent(driver.portal_token) + path;
  }

  // 同じドライバーへの通知は1日1通にまとめる (LINE の月間送信数 = 料金を抑えるため)
  var queue = {};
  function notify(driver, kind, body, path) {
    if (!driver || !driver.line_user_id) return;
    var q = queue[driver.id] || (queue[driver.id] = { driver: driver, items: [] });
    q.items.push({ kind: kind, body: body, path: path });
  }
  function flush() {
    var sent = 0;
    Object.keys(queue).forEach(function (id) {
      var q = queue[id];
      var d = q.driver;
      var bodies = q.items.map(function (it) { return q.items.length > 1 ? "■ " + it.body : it.body; });
      var text =
        d.name + " さん\n管理者です。\n\n" + bodies.join("\n\n") +
        "\n\n▼【" + d.name + "さん専用】提出フォーム\n" + url(d, q.items[0].path) +
        "\n\n※このURLはご本人専用です。他の方と共有しないでください。";
      pushLine_(d.line_user_id, text);
      q.items.forEach(function (it) { appendLog_(d.id, it.kind); });
      sent++;
    });
    return sent;
  }

  drivers.forEach(function (d) {
    // 免許
    if (isYmd_(d.license_expiry)) {
      var days = daysBetween_(today, d.license_expiry);
      if (days <= THRESHOLDS.expiryWarnDays && shouldNotifyExpiry(days)) {
        notify(d, "license",
          days < 0
            ? "運転免許証の更新期限が【超過】しております（" + -days + "日）。\n至急、新しい免許証の写真（表・裏）をアップロードしてください。"
            : "運転免許証の有効期限まで残り" + days + "日です。\n更新後、新しい免許証の写真（表・裏）をアップロードしてください。",
          "&tab=docs&doc=license");
      }
    }

    var myVehicles = vehicles.filter(function (v) { return v.current_driver_id === d.id; });
    myVehicles.forEach(function (v) {
      [["inspection", "inspection_expiry", "車検満了日"], ["insurance", "insurance_expiry", "自賠責の満了日"]].forEach(function (c) {
        if (!isYmd_(v[c[1]])) return;
        var days = daysBetween_(today, v[c[1]]);
        if (days <= THRESHOLDS.expiryWarnDays && shouldNotifyExpiry(days)) {
          notify(d, c[0],
            "担当車両（" + v.plate + "）の" + c[2] + "まで" + (days < 0 ? "【超過" + -days + "日】" : "残り" + days + "日") +
            "です。\n更新後、新しい書類の写真をアップロードしてください。",
            "&tab=docs&doc=vehicle");
        }
      });

      var sinceOil = Number(v.current_mileage || 0) - Number(v.last_oil_mileage || 0);
      if (sinceOil >= THRESHOLDS.oilChangeKm && lastAutoDays(d.id, "oil") >= REPEAT_INTERVAL_DAYS) {
        notify(d, "oil",
          "担当車両（" + v.plate + "）は前回のオイル交換から " + sinceOil + "km 走行しています。\nオイル交換を実施し、レシート写真を添えて報告してください。",
          "&tab=daily");
      }
    });

    // 未報告 (固定車両を持つドライバーのみ)
    var hasFixed = myVehicles.some(function (v) { return v.usage_type === "fixed"; });
    if (hasFixed) {
      var last = reports
        .filter(function (r) { return r.driver_id === d.id; })
        .map(function (r) { return r.date; })
        .sort()
        .pop();
      var since = last ? daysBetween_(Utilities.formatDate(new Date(last), "Asia/Tokyo", "yyyy-MM-dd"), today) : Infinity;
      if (since >= THRESHOLDS.unreportedDays && lastAutoDays(d.id, "unreported") >= REPEAT_INTERVAL_DAYS) {
        notify(d, "unreported", "走行距離の報告が2週間以上ありません。\n現在のメーター（走行距離）を報告してください。", "&tab=daily");
      }
    }
  });

  console.log("dailyNotify: sent=" + flush() + " messages");
}

function pushLine_(to, text) {
  var token = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ to: to, messages: [{ type: "text", text: text }] }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) console.error("LINE push failed: " + res.getContentText());
}

// ---------- LINE Webhook: line_user_id の自動紐付け ----------
// ドライバーに https://line.me/R/oaMessage/<公式アカウントID>/?text=登録:<portal_token>
// のリンクを渡すと、タップ→送信だけで紐付けが完了する。
// ※GAS の doPost ではリクエストヘッダーを参照できず署名検証ができないため、
//   推測困難な portal_token の一致のみで照合している。
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  (body.events || []).forEach(function (ev) {
    if (ev.type !== "message" || ev.message.type !== "text") return;
    var m = ev.message.text.trim().match(/^登録[:：]\s*([A-Za-z0-9-]{8,})$/);
    if (!m) return;
    var sheet = SpreadsheetApp.getActive().getSheetByName("drivers");
    var values = sheet.getDataRange().getValues();
    var header = values[0];
    var tokenCol = header.indexOf("portal_token");
    var lineCol = header.indexOf("line_user_id");
    var nameCol = header.indexOf("name");
    for (var i = 1; i < values.length; i++) {
      if (values[i][tokenCol] === m[1]) {
        sheet.getRange(i + 1, lineCol + 1).setValue(ev.source.userId);
        replyLine_(ev.replyToken, values[i][nameCol] + " さん、LINE通知の登録が完了しました。");
        return;
      }
    }
    replyLine_(ev.replyToken, "登録コードが見つかりませんでした。管理者にお問い合わせください。");
  });
  return ContentService.createTextOutput("OK");
}

function replyLine_(replyToken, text) {
  var token = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: "text", text: text }] }),
    muteHttpExceptions: true,
  });
}
