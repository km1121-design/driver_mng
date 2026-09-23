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
