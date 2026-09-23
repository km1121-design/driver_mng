"use server";

import { verifyLiffIdToken } from "@/lib/line-login";
import { notifyAdmin } from "@/lib/line";
import { getRepo } from "@/lib/repo";

export type EnterResult =
  | { ok: true; token: string; linked: boolean }
  | { ok: false; reason: "unlinked" | "invalid_link" | "error"; message?: string };

/**
 * LINE のリッチメニュー (LIFF) からの入口。
 * ID トークンで本人の LINE ユーザーIDを確かめ、台帳の line_user_id が一致するドライバーの
 * ポータルトークンを返す。linkToken (ポータルトークン) 付きで開かれた場合は、先に紐付けを行う。
 */
export async function enterPortal(idToken: string, linkToken: string | null): Promise<EnterResult> {
  try {
    const userId = await verifyLiffIdToken(idToken);
    const repo = getRepo();
    const drivers = (await repo.list("drivers")).filter((d) => d.status !== "retired");

    if (linkToken) {
      const target = drivers.find((d) => d.portal_token === linkToken);
      if (!target) return { ok: false, reason: "invalid_link" };
      if (target.line_user_id !== userId) {
        // 1つの LINE アカウントが複数のドライバーに紐付かないよう、他の行からは外す
        for (const other of drivers) {
          if (other.id !== target.id && other.line_user_id === userId) {
            await repo.update("drivers", other.id, { line_user_id: "" });
          }
        }
        const changed = Boolean(target.line_user_id);
        await repo.update("drivers", target.id, { line_user_id: userId });
        await notifyAdmin(`【LINE連携】${target.name} さんの LINE を${changed ? "変更" : "登録"}しました。`);
      }
      return { ok: true, token: target.portal_token, linked: true };
    }

    const driver = drivers.find((d) => d.line_user_id === userId);
    if (!driver) return { ok: false, reason: "unlinked" };
    return { ok: true, token: driver.portal_token, linked: false };
  } catch (e) {
    console.error("[enterPortal]", e);
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : undefined };
  }
}
