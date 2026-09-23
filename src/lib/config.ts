// 業務ルールのしきい値。GAS (gas/notify.gs) 側と値を揃えること。
export const THRESHOLDS = {
  /** 免許・車検・自賠責の期限アラートを出す残日数 */
  expiryWarnDays: 45,
  /** 残日数がこれ以下なら「緊急」扱い */
  expiryCriticalDays: 14,
  /** 前回オイル交換からの走行距離 (km) */
  oilChangeKm: 5000,
  /** 走行距離の未報告日数 */
  unreportedDays: 14,
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
