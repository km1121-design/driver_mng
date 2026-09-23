import { connection } from "next/server";
import { isLiffConfigured } from "@/lib/line-login";
import { isSheetsMode } from "@/lib/repo";
import { LiffEntry } from "./liff-entry";

export const metadata = { title: "ドライバーポータル" };

// LINE のリッチメニューから開く入口 (https://liff.line.me/<LIFF_ID>)。
// ログインした LINE アカウントからドライバーを特定し、専用ポータルへ転送する。
export default async function LiffPage() {
  await connection();
  const configured = isLiffConfigured();
  return (
    <LiffEntry
      liffId={configured ? process.env.LIFF_ID! : null}
      demo={!configured && !isSheetsMode()}
      adminPhone={process.env.ADMIN_PHONE ?? ""}
    />
  );
}
