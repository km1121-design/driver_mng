"use client";

import { Loader2, Phone, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { enterPortal } from "./actions";

type View =
  | { kind: "loading" }
  | { kind: "unlinked" }
  | { kind: "invalid_link" }
  | { kind: "error"; message: string };

const DEMO_USER = "U0000000000000000000000000000d001";

/**
 * https://liff.line.me/<LIFF_ID>?link=xxx で開くと、最初は ?liff.state=%3Flink%3Dxxx の形で届き、
 * liff.init() の中で ?link=xxx に付け替えられる。どちらの段階で読んでも同じ値になるよう両方を見る。
 */
function currentParams() {
  const params = new URLSearchParams(location.search);
  const state = params.get("liff.state");
  if (state) {
    const q = state.includes("?") ? state.slice(state.indexOf("?") + 1) : "";
    new URLSearchParams(q).forEach((v, k) => {
      if (!params.has(k)) params.set(k, v);
    });
  }
  return params;
}

/** ポータルへ引き継ぐクエリ (リッチメニューのボタンごとに開くタブを変えられる) */
function portalQuery(token: string, params: URLSearchParams) {
  const q = new URLSearchParams({ id: token });
  for (const key of ["tab", "doc"]) {
    const v = params.get(key);
    if (v) q.set(key, v);
  }
  return q.toString();
}

async function getIdToken(liffId: string | null, demo: boolean, params: URLSearchParams) {
  if (!liffId) {
    if (!demo) throw new Error("LINE との連携が設定されていません。管理者へご連絡ください。");
    return `mock:${params.get("mock_user") ?? DEMO_USER}`;
  }
  const liff = (await import("@line/liff")).default;
  await liff.init({ liffId });
  if (!liff.isLoggedIn()) {
    // LINE アプリ内では自動でログイン済み。外部ブラウザで開いた場合のみここに来る
    liff.login({ redirectUri: location.href });
    return null;
  }
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error("LINE の本人確認ができませんでした (LIFF の scope に openid が必要です)");
  return idToken;
}

export function LiffEntry({ liffId, demo, adminPhone }: { liffId: string | null; demo: boolean; adminPhone: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const idToken = await getIdToken(liffId, demo, currentParams());
        if (!idToken || cancelled) return;
        const params = currentParams();
        const r = await enterPortal(idToken, params.get("link"));
        if (cancelled) return;
        if (r.ok) location.replace(`/portal?${portalQuery(r.token, params)}`);
        else if (r.reason === "error") setView({ kind: "error", message: r.message ?? "読み込みに失敗しました" });
        else setView({ kind: r.reason });
      } catch (e) {
        if (!cancelled) setView({ kind: "error", message: e instanceof Error ? e.message : "読み込みに失敗しました" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liffId, demo]);

  if (view.kind === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 p-6 text-slate-500">
        <Loader2 className="size-8 animate-spin" />
        <p className="text-sm">読み込み中...</p>
      </main>
    );
  }

  const text = {
    unlinked: {
      title: "LINE がまだ登録されていません",
      body: "管理者から届いた「LINE 登録用リンク」を開くと、次回からこのメニューで開けるようになります。リンクが届いていない場合は管理者へご連絡ください。",
    },
    invalid_link: {
      title: "登録用リンクが無効です",
      body: "リンクの期限が切れているか、再発行されています。管理者に新しいリンクを依頼してください。",
    },
    error: { title: "開けませんでした", body: view.kind === "error" ? view.message : "" },
  }[view.kind];

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="card max-w-sm p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 size-10 text-slate-400" />
        <h1 className="mb-2 font-bold">{text.title}</h1>
        <p className="text-sm text-slate-500">{text.body}</p>
        {adminPhone && (
          <a
            href={`tel:${adminPhone}`}
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-bold text-white"
          >
            <Phone className="size-4" /> 管理者に電話する
          </a>
        )}
      </div>
    </main>
  );
}
