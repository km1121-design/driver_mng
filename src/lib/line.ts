import "server-only";

/** LINE Messaging API で個別にプッシュ送信する。トークン未設定時はログ出力のみ (デモ) */
export async function pushLineMessage(to: string, text: string): Promise<{ demo: boolean }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.info(`[LINE demo] to=${to || "(未連携)"}\n${text}`);
    return { demo: true };
  }
  if (!to) throw new Error("このドライバーは LINE 未連携です (line_user_id が空)");
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LINE API ${res.status}: ${await res.text()}`);
  return { demo: false };
}
