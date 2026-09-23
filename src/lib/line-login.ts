import "server-only";
import { isSheetsMode } from "./repo";

/** デモモードで LIFF の代わりに使う疑似 ID トークン (mock:<LINEユーザーID>) */
const MOCK_PREFIX = "mock:";

export function isLiffConfigured() {
  return Boolean(process.env.LIFF_ID && process.env.LINE_LOGIN_CHANNEL_ID);
}

/**
 * LIFF の ID トークンを LINE のサーバーで検証し、LINE ユーザーID (sub) を返す。
 * ユーザーID はプロバイダーごとに異なるため、LINE ログインチャネルは
 * 公式アカウント (Messaging API) と同じプロバイダーに作ること。
 */
export async function verifyLiffIdToken(idToken: string): Promise<string> {
  if (!isLiffConfigured()) {
    // 本番で設定漏れのまま疑似トークンを受け付けないよう、デモデータ時のみ許可する
    if (!isSheetsMode() && idToken.startsWith(MOCK_PREFIX)) return idToken.slice(MOCK_PREFIX.length);
    throw new Error("LIFF が設定されていません (LIFF_ID / LINE_LOGIN_CHANNEL_ID)");
  }
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: process.env.LINE_LOGIN_CHANNEL_ID! }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LINE ログインの確認に失敗しました (${res.status})`);
  const data = (await res.json()) as { sub?: string };
  if (!data.sub) throw new Error("LINE ユーザーIDを取得できませんでした");
  return data.sub;
}
