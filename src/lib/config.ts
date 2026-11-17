// 業務ルールのしきい値。GAS (gas/notify.gs) 側と値を揃えること。
export const THRESHOLDS = {
  /** 免許・車検・自賠責の期限アラートを出す残日数 */
  expiryWarnDays: 45,
  /** 残日数がこれ以下なら「緊急」扱い */
  expiryCriticalDays: 14,
  /** 残日数がこれ以下でまだ更新されていなければ、本人任せにせず管理者が確認する */
  expiryEscalateDays: 7,
  /** 前回オイル交換からの走行距離 (km) */
  oilChangeKm: 5000,
  /** これを超えてもオイル交換の報告がなければ管理者が確認する (km) */
  oilEscalateKm: 6000,
  /** 走行距離は毎月1回。この日までに今月の報告がなければ管理者が確認する */
  mileageDueDay: 7,
} as const;

// 通知のスケジュール (GAS 側の値と揃えること)
export const NOTIFY = {
  /** ドライバーへの自動通知の時刻 (シフトのリマインド 22時 に合わせる) */
  driverHour: 22,
  /** 管理者へのまとめ通知の時刻 */
  adminHour: 8,
  /** 走行距離の報告をお願いする日 (今月まだ報告がない人だけ) */
  mileageReminderDays: [1, 5],
} as const;

export const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

export function portalUrl(token: string) {
  return `${APP_BASE_URL}/portal?id=${encodeURIComponent(token)}`;
}

/** LINE のリッチメニューから開く入口の URL。LIFF 未設定 (デモ) 時はアプリ内の /liff を使う */
export function liffUrl(query?: Record<string, string>) {
  const q = query ? `?${new URLSearchParams(query)}` : "";
  const liffId = process.env.LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}${q}` : `${APP_BASE_URL}/liff${q}`;
}

/**
 * LINE の通知文に入れるドライバー用リンク。LIFF 設定済みなら LINE ログインで本人を確かめる
 * LIFF の URL (トークンをメッセージに載せない)、未設定ならポータルトークン付き URL。
 * path は "&tab=docs&doc=license" の形式。
 */
export function driverLink(portalToken: string, path = "") {
  const liffId = process.env.LIFF_ID;
  if (liffId) return `https://liff.line.me/${liffId}${path ? `?${path.slice(1)}` : ""}`;
  return portalUrl(portalToken) + path;
}
