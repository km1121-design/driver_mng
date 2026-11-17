/**
 * FleetManager 自動通知スクリプト (Google Apps Script)
 *
 * 設置方法:
 *   1. DB 用スプレッドシートで「拡張機能 > Apps Script」を開き、このファイルを貼り付ける
 *   2. 「プロジェクトの設定 > スクリプト プロパティ」に以下を登録
 *        LINE_CHANNEL_ACCESS_TOKEN : LINE Messaging API のチャネルアクセストークン
 *        APP_BASE_URL              : Next.js アプリの URL (例: https://fleet.example.com)
 *        ADMIN_LINE_USER_ID        : 管理者の LINE ユーザーID (朝のまとめ通知の宛先)
 *        LIFF_ID                   : (任意) 設定すると通知のリンクを LIFF の URL にする
 *                                    (LINE ログインで本人確認するため、URL にトークンを載せない)
 *   3. setupTrigger() を一度だけ手動実行 → 次の2つが動く
 *        dailyNotify  毎晩 22 時台: ドライバーへの通知 (シフトのリマインドと同じ時間帯)
 *        adminDigest  毎朝 8 時台 : 管理者へのまとめ (新しく管理者の対応が必要になったものがある日と、毎週月曜)
 *   4. (任意・通常は不要) ウェブアプリとしてデプロイし、その URL を LINE の Webhook URL に設定すると
 *      「登録:<ポータルトークン>」メッセージで line_user_id を自動紐付けできる。
 *      LIFF の「LINE 登録用リンク」で紐付けられるため、LIFF を使う場合は設定しなくてよい。
 *      他のツールが Webhook を使っている場合は、上書きするとそのツールが止まるので設定しないこと。
 *
 * ルールは src/lib/config.ts の THRESHOLDS / NOTIFY と、src/lib/alerts.ts の判定と揃えること。
 *
 * 現場優先の考え方:
 *   - ドライバーへの催促は「期限の節目の日」と「月初の走行距離」だけ。同じ日の通知は1通にまとめる
 *   - 期限の7日前を過ぎても更新がない・期限切れ・オイル6,000km超・走行距離の締め日超過は、
 *     本人への催促を重ねず管理者へ引き継ぐ (adminDigest)
 */

var THRESHOLDS = {
  expiryWarnDays: 45,
  expiryEscalateDays: 7,
  oilChangeKm: 5000,
  oilEscalateKm: 6000,
  mileageDueDay: 7,
};
/** 期限系はこの残日数の日だけ本人に通知する */
var EXPIRY_NOTIFY_DAYS = [45, 30, 14, 7, 3, 1, 0];
/** 期限切れ・オイル交換は、前回の自動通知からこの日数あける (週1回まで) */
var REPEAT_DAYS = 7;
/** 走行距離 (月1回) は、今月まだ報告がない人にこの日だけ通知する */
var MILEAGE_REMINDER_DAYS = [1, 5];
var DRIVER_HOUR = 22;
var ADMIN_HOUR = 8;

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === "dailyNotify" || fn === "adminDigest") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("dailyNotify").timeBased().atHour(DRIVER_HOUR).everyDays(1).inTimezone("Asia/Tokyo").create();
  ScriptApp.newTrigger("adminDigest").timeBased().atHour(ADMIN_HOUR).everyDays(1).inTimezone("Asia/Tokyo").create();
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

/** channel: auto = ドライバーへの自動通知 / escalated = 管理者へ引き継いだ記録 (driver_id には担当者のいない車両の id が入ることがある) */
function appendLog_(driverId, kind, channel) {
  var sheet = SpreadsheetApp.getActive().getSheetByName("alert_logs");
  if (!sheet) return;
  sheet.appendRow(["log_" + Utilities.getUuid().replace(/-/g, "").slice(0, 12), new Date().toISOString(), driverId, kind, channel || "auto"]);
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

// ---------- 共通 ----------

function loadData_() {
  return {
    drivers: readTable_("drivers").filter(function (d) { return d.status === "active"; }),
    vehicles: readTable_("vehicles").filter(function (v) { return v.status !== "retired"; }),
    reports: readTable_("daily_reports"),
    logs: readTable_("alert_logs"),
    defects: readTable_("defect_reports"),
  };
}

function ymdJst_(iso) {
  return Utilities.formatDate(new Date(iso), "Asia/Tokyo", "yyyy-MM-dd");
}

/** 走行距離の報告対象 = 固定車両を持つ稼働中ドライバー */
function needsMileage_(d, vehicles) {
  return vehicles.some(function (v) { return v.current_driver_id === d.id && v.usage_type === "fixed"; });
}

function reportedThisMonth_(d, reports, today) {
  var month = today.slice(0, 7);
  return reports.some(function (r) { return r.driver_id === d.id && ymdJst_(r.date).slice(0, 7) === month; });
}

function lastLogDays_(logs, id, kind, channel, today) {
  var last = logs
    .filter(function (l) { return l.driver_id === id && l.kind === kind && l.channel === channel; })
    .map(function (l) { return l.date; })
    .sort()
    .pop();
  return last ? daysBetween_(ymdJst_(last), today) : Infinity;
}

// ---------- ドライバーへの通知 (毎晩 22 時台) ----------

function dailyNotify() {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty("APP_BASE_URL");
  var liffId = props.getProperty("LIFF_ID");
  var today = todayJst_();
  var dayOfMonth = Number(today.slice(8));
  var data = loadData_();

  function url(driver, path) {
    // src/lib/config.ts の driverLink と同じ規則
    if (liffId) return "https://liff.line.me/" + liffId + (path ? "?" + path.slice(1) : "");
    return baseUrl + "/portal?id=" + encodeURIComponent(driver.portal_token) + path;
  }
  function expiryDue(id, kind, days) {
    if (days < 0) return lastLogDays_(data.logs, id, kind, "auto", today) >= REPEAT_DAYS;
    return EXPIRY_NOTIFY_DAYS.indexOf(days) >= 0;
  }

  // 同じドライバーへの通知は1日1通にまとめる (LINE の月間送信数 = 料金を抑えるため)
  var queue = {};
  function notify(driver, kind, body, path) {
    if (!driver || !driver.line_user_id) return;
    var q = queue[driver.id] || (queue[driver.id] = { driver: driver, items: [] });
    q.items.push({ kind: kind, body: body, path: path });
  }

  data.drivers.forEach(function (d) {
    if (isYmd_(d.license_expiry)) {
      var days = daysBetween_(today, d.license_expiry);
      if (days <= THRESHOLDS.expiryWarnDays && expiryDue(d.id, "license", days)) {
        notify(d, "license",
          days < 0
            ? "運転免許証の有効期限が切れています（" + -days + "日超過）。\n更新した免許証の写真（表・裏）を送ってください。"
            : "運転免許証の有効期限まで あと" + days + "日です。\n更新したら、新しい免許証の写真（表・裏）を送ってください。",
          "&tab=docs&doc=license");
      }
    }

    var myVehicles = data.vehicles.filter(function (v) { return v.current_driver_id === d.id; });
    myVehicles.forEach(function (v) {
      [["inspection", "inspection_expiry", "車検"], ["insurance", "insurance_expiry", "自賠責"]].forEach(function (c) {
        if (!isYmd_(v[c[1]])) return;
        var days = daysBetween_(today, v[c[1]]);
        if (days <= THRESHOLDS.expiryWarnDays && expiryDue(d.id, c[0], days)) {
          notify(d, c[0],
            "担当車両（" + v.plate + "）の" + c[2] + "の満了日まで" + (days < 0 ? "【" + -days + "日超過】" : " あと" + days + "日") +
            "です。\n更新したら、新しい書類の写真を送ってください。",
            "&tab=docs&doc=vehicle");
        }
      });

      var sinceOil = Number(v.current_mileage || 0) - Number(v.last_oil_mileage || 0);
      if (sinceOil >= THRESHOLDS.oilChangeKm && lastLogDays_(data.logs, d.id, "oil", "auto", today) >= REPEAT_DAYS) {
        notify(d, "oil",
          "担当車両（" + v.plate + "）は前回のオイル交換から " + sinceOil + "km 走っています。\n交換したら、レシートの写真を添えて報告してください。",
          "&tab=daily");
      }
    });

    // 走行距離は月1回。月初 (1日・5日) に、今月まだ報告がない人だけ
    if (MILEAGE_REMINDER_DAYS.indexOf(dayOfMonth) >= 0 && needsMileage_(d, data.vehicles) && !reportedThisMonth_(d, data.reports, today)) {
      notify(d, "unreported",
        "今月の走行距離の報告をお願いします（" + THRESHOLDS.mileageDueDay + "日まで）。\nメーターの数字を入れるだけで終わります。",
        "&tab=daily");
    }
  });

  var sent = 0;
  Object.keys(queue).forEach(function (id) {
    var q = queue[id];
    var d = q.driver;
    var bodies = q.items.map(function (it) { return q.items.length > 1 ? "■ " + it.body : it.body; });
    var text =
      d.name + " さん\nおつかれさまです。管理者です。\n\n" + bodies.join("\n\n") +
      // 1件ならその提出画面、複数ならホーム (今やること一覧) を開く
      "\n\n▼ここから開けます（メニューの「車両管理」からも開けます）\n" + url(d, q.items.length === 1 ? q.items[0].path : "") +
      (liffId ? "" : "\n\n※このURLはご本人専用です。他の方と共有しないでください。");
    pushLine_(d.line_user_id, text);
    q.items.forEach(function (it) { appendLog_(d.id, it.kind, "auto"); });
    sent++;
  });
  console.log("dailyNotify: sent=" + sent + " messages");
}

// ---------- 管理者へのまとめ (毎朝 8 時台) ----------

/** src/lib/alerts.ts の waitingOn = "admin" と同じ判定 */
function adminItems_(data, today) {
  var items = [];
  var byId = {};
  data.drivers.forEach(function (d) { byId[d.id] = d; });

  function expiryTask(days, what) {
    if (days < 0) return "期限切れ。乗務させる前に" + what + "を確認";
    if (days <= THRESHOLDS.expiryEscalateDays) return "本人に" + what + "の予定を確認";
    return null;
  }

  data.drivers.forEach(function (d) {
    if (isYmd_(d.license_expiry)) {
      var days = daysBetween_(today, d.license_expiry);
      var t = expiryTask(days, "免許の更新");
      if (t) items.push({ id: d.id, kind: "license", who: d.name, what: days < 0 ? "免許証が期限切れ（" + -days + "日超過）" : "免許証の期限まであと" + days + "日", task: t });
    }
    if (needsMileage_(d, data.vehicles) && Number(today.slice(8)) > THRESHOLDS.mileageDueDay && !reportedThisMonth_(d, data.reports, today)) {
      items.push({ id: d.id, kind: "unreported", who: d.name, what: "今月の走行距離が未報告", task: "本人に報告を依頼" });
    }
  });

  data.vehicles.forEach(function (v) {
    var d = byId[v.current_driver_id];
    var who = v.plate + (d ? "（" + d.name + "）" : "（担当なし）");
    var id = d ? d.id : v.id;
    [["inspection", "inspection_expiry", "車検"], ["insurance", "insurance_expiry", "自賠責の更新"]].forEach(function (c) {
      if (!isYmd_(v[c[1]])) return;
      var days = daysBetween_(today, v[c[1]]);
      if (days > THRESHOLDS.expiryWarnDays) return;
      var t = expiryTask(days, c[2]) || (d ? null : c[2] + "を手配");
      if (t) items.push({ id: id, kind: c[0], who: who, what: c[2].replace("の更新", "") + (days < 0 ? "が期限切れ（" + -days + "日超過）" : "の満了まであと" + days + "日"), task: t });
    });
    var sinceOil = Number(v.current_mileage || 0) - Number(v.last_oil_mileage || 0);
    if (sinceOil >= THRESHOLDS.oilEscalateKm || (sinceOil >= THRESHOLDS.oilChangeKm && !d)) {
      items.push({ id: id, kind: "oil", who: who, what: "オイル交換から" + sinceOil + "km", task: "オイル交換を手配・確認" });
    }
  });
  return items;
}

function adminDigest() {
  var props = PropertiesService.getScriptProperties();
  var adminId = props.getProperty("ADMIN_LINE_USER_ID");
  var baseUrl = props.getProperty("APP_BASE_URL");
  if (!adminId) return console.log("adminDigest: ADMIN_LINE_USER_ID が未設定");
  var today = todayJst_();
  var isMonday = Utilities.formatDate(new Date(), "Asia/Tokyo", "u") === "1";
  var data = loadData_();

  var items = adminItems_(data, today);
  // 新しく管理者の対応が必要になったもの (同じ件は30日に1回だけ「新規」として知らせる)
  var fresh = items.filter(function (it) { return lastLogDays_(data.logs, it.id, it.kind, "escalated", today) > 30; });
  var openDefects = data.defects.filter(function (x) { return x.status === "open"; }).length;
  var unlinked = data.drivers.filter(function (d) { return !d.line_user_id; }).length;

  if (!fresh.length && !isMonday) return console.log("adminDigest: 新しい項目なし");

  var lines = [];
  function line(it) {
    return "・" + it.who + "：" + it.what + "\n　→ " + it.task;
  }
  if (isMonday) {
    // 月曜は継続中のものも含めて全部 (新しいものに印)
    lines.push("【管理者の対応が必要】" + items.length + "件");
    items.slice(0, 15).forEach(function (it) { lines.push((fresh.indexOf(it) >= 0 ? "🆕" : "") + line(it)); });
    if (items.length > 15) lines.push("ほか " + (items.length - 15) + "件はダッシュボードで確認してください");
    var targets = data.drivers.filter(function (d) { return needsMileage_(d, data.vehicles); });
    var reported = targets.filter(function (d) { return reportedThisMonth_(d, data.reports, today); }).length;
    lines.push("", "【今週のまとめ】");
    lines.push("・未対応のキズ・不具合報告：" + openDefects + "件");
    lines.push("・LINE 未連携のドライバー：" + unlinked + "名");
    lines.push("・今月の走行距離：" + reported + " / " + targets.length + "名 報告済み");
  } else {
    lines.push("【新しく対応が必要】");
    fresh.forEach(function (it) { lines.push(line(it)); });
    var ongoing = items.length - fresh.length;
    if (ongoing > 0) lines.push("", "ほかに継続中の項目が " + ongoing + "件あります。");
  }

  var text = "【車両管理】おはようございます。\n\n" + lines.join("\n") + "\n\n▼ダッシュボード\n" + baseUrl + "/";
  pushLine_(adminId, text);
  fresh.forEach(function (it) { appendLog_(it.id, it.kind, "escalated"); });
  console.log("adminDigest: fresh=" + fresh.length + " total=" + items.length);
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
