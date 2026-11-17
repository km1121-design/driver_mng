"use client";

import { Copy } from "lucide-react";
import { useToast } from "./toast";

export function CopyButton({ text, label, done, className }: { text: string; label: string; done: string; className?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => toast(done, "success"))}
      className={className}
    >
      <Copy className="size-3.5" /> {label}
    </button>
  );
}
