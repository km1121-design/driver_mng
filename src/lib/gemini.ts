import "server-only";
import type { DocType } from "./types";

export type OcrResult = {
  /** 有効期限 (YYYY-MM-DD)。読み取れなければ空文字 */
  expiry_date: string;
  /** 補足情報 (免許証番号・ナンバー等) */
  details: Record<string, string>;
  /** 読み取れなかった / 不鮮明などの注意 */
  warning: string;
  demo?: boolean;
};

// 電子車検証 (IC車検証) の券面には有効期間満了日が印字されないため、
// 満了日は「自動車検査証記録事項」から読み取る。
const PROMPTS: Partial<Record<DocType, { instruction: string; detailKeys: string[] }>> = {
  license_front: {
    instruction:
      "これは日本の運転免許証の表面です。「○年○月○日まで有効」の日付を有効期限として読み取ってください。license_number は「番号」欄の12桁の数字、license_class は「種類」欄で取得済みの免許区分を「・」区切りで (例: 普通・準中型)、license_conditions は「免許の条件等」欄の内容を「、」区切りで (例: AT限定、眼鏡等。記載がなければ空文字) 入れてください。",
    detailKeys: ["name", "license_number", "license_class", "license_conditions"],
  },
  inspection_cert: {
    instruction:
      "これは日本の自動車検査証 (電子車検証を含む) です。自動車登録番号 (ナンバー) を読み取ってください。有効期間の満了する日が記載されていればそれを有効期限としてください。",
    detailKeys: ["plate", "car_name"],
  },
  inspection_record: {
    instruction:
      "これは日本の「自動車検査証記録事項」です。「有効期間の満了する日」を有効期限として読み取ってください。",
    detailKeys: ["plate"],
  },
  insurance_cert: {
    instruction:
      "これは日本の自動車損害賠償責任保険証明書 (自賠責) です。保険期間の終期 (満了日) を有効期限として読み取ってください。",
    detailKeys: ["plate", "policy_number"],
  },
};

export function supportsOcr(docType: DocType) {
  return docType in PROMPTS;
}

export async function runOcr(
  docType: DocType,
  file: { mimeType: string; base64: string },
): Promise<OcrResult> {
  const spec = PROMPTS[docType];
  if (!spec) return { expiry_date: "", details: {}, warning: "" };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // デモ用ダミー結果
    await new Promise((r) => setTimeout(r, 800));
    const d = new Date();
    d.setFullYear(d.getFullYear() + (docType === "license_front" ? 3 : 2));
    return {
      expiry_date: d.toISOString().slice(0, 10),
      details:
        docType === "license_front"
          ? { license_number: "301234567890", license_class: "普通・準中型", license_conditions: "眼鏡等" }
          : { plate: "品川 500 め 12-34" },
      warning: "",
      demo: true,
    };
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const prompt = `${spec.instruction}
和暦 (令和・平成) の場合は西暦に変換し、expiry_date は YYYY-MM-DD 形式で返してください。
読み取れない・画像が不鮮明・別の書類の場合は expiry_date を空文字にし、warning に理由を日本語で簡潔に書いてください。
details には ${spec.detailKeys.join(", ")} を読み取れた範囲で入れてください。`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: file.mimeType, data: file.base64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          // 期限の読み取りに推論は不要。思考トークン (出力単価で課金) を止めてコストと待ち時間を抑える
          ...(model.startsWith("gemini-2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              expiry_date: { type: "STRING" },
              details: {
                type: "OBJECT",
                properties: Object.fromEntries(spec.detailKeys.map((k) => [k, { type: "STRING" }])),
              },
              warning: { type: "STRING" },
            },
            required: ["expiry_date", "warning"],
          },
        },
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text) as Partial<OcrResult>;
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(parsed.expiry_date ?? "") ? parsed.expiry_date! : "";
  return {
    expiry_date: expiry,
    details: parsed.details ?? {},
    warning: expiry ? (parsed.warning ?? "") : parsed.warning || "有効期限を読み取れませんでした",
  };
}
