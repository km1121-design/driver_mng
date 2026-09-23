const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** JST での今日 (YYYY-MM-DD) */
export function todayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 今日から対象日までの日数。過去日は負数。不正値は null */
export function daysUntil(ymd: string, now: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const target = Date.parse(`${ymd}T00:00:00Z`);
  const today = Date.parse(`${todayJst(now)}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  return Math.round((target - today) / DAY_MS);
}

/** ISO 日時から今日までの経過日数 */
export function daysSince(iso: string, now: Date = new Date()): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const from = Date.parse(`${todayJst(new Date(t))}T00:00:00Z`);
  const today = Date.parse(`${todayJst(now)}T00:00:00Z`);
  return Math.round((today - from) / DAY_MS);
}

export function formatYmd(ymd: string): string {
  return ymd ? ymd.replaceAll("-", "/") : "—";
}

export function formatDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const d = new Date(t + JST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function formatKm(km: number): string {
  return `${km.toLocaleString("ja-JP")} km`;
}
