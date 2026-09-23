export type ActionResult = { ok: boolean; message: string } | null;

export function fail(e: unknown): ActionResult {
  console.error(e);
  return { ok: false, message: e instanceof Error ? e.message : "処理に失敗しました" };
}

export function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
