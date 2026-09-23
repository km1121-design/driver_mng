"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { resolveDefect } from "../actions";

export function ResolveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await resolveDefect(id);
          if (r) toast(r.message, r.ok ? "success" : "error");
        })
      }
      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? "更新中..." : "対応済みにする"}
    </button>
  );
}
