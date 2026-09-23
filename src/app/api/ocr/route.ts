import { NextResponse } from "next/server";
import { resolvePortal } from "@/lib/data";
import { runOcr, supportsOcr } from "@/lib/gemini";
import { validateUpload } from "@/lib/storage";
import type { DocType } from "@/lib/types";
import { DOC_TYPE_LABEL } from "@/lib/types";

// ドライバーポータルからの OCR 要求。ポータルトークンで認可する。
export async function POST(request: Request) {
  const form = await request.formData();
  const portal = await resolvePortal(String(form.get("token") ?? ""));
  if (!portal) return NextResponse.json({ error: "URLが無効です" }, { status: 401 });

  const docType = String(form.get("doc_type") ?? "") as DocType;
  const file = form.get("file");
  if (!(docType in DOC_TYPE_LABEL) || !(file instanceof File)) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  if (!supportsOcr(docType)) {
    return NextResponse.json({ expiry_date: "", details: {}, warning: "" });
  }
  try {
    validateUpload(file);
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return NextResponse.json(await runOcr(docType, { mimeType: file.type, base64 }));
  } catch (e) {
    console.error("[ocr]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "読み取りに失敗しました" },
      { status: 500 },
    );
  }
}
