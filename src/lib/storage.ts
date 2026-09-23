import "server-only";
import { googleFetch } from "./google/auth";
import { isSheetsMode, newId } from "./repo";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export function validateUpload(file: File) {
  if (file.size === 0) throw new Error("ファイルが空です");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("ファイルサイズが大きすぎます (最大8MB)");
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("画像 (JPEG/PNG/WebP/HEIC) または PDF を選択してください");
  }
}

// ---- モック: メモリ保持し /api/mock-files/[id] で配信 ----
const mem = globalThis as unknown as {
  __fleetMockFiles?: Map<string, { type: string; data: Buffer }>;
};
export function getMockFile(id: string) {
  return mem.__fleetMockFiles?.get(id);
}

/**
 * ファイルを保存して閲覧用URLを返す。
 * Sheets モードでは Google Drive の共有ドライブ内フォルダ (GOOGLE_DRIVE_FOLDER_ID) に保存する。
 * ※サービスアカウントはマイドライブに容量を持たないため、共有ドライブが必須。
 */
export async function saveFile(file: File, label: string): Promise<string> {
  validateUpload(file);
  const data = Buffer.from(await file.arrayBuffer());

  if (!isSheetsMode()) {
    mem.__fleetMockFiles ??= new Map();
    const id = newId("f");
    mem.__fleetMockFiles.set(id, { type: file.type, data });
    return `/api/mock-files/${id}`;
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID が未設定です");
  const ext = file.type === "application/pdf" ? "pdf" : (file.type.split("/")[1] ?? "bin");
  const metadata = {
    name: `${new Date().toISOString().slice(0, 10)}_${label}.${ext}`,
    parents: [folderId],
  };
  const boundary = `fleet${crypto.randomUUID()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await googleFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const json = (await res.json()) as { id: string; webViewLink?: string };
  return json.webViewLink ?? `https://drive.google.com/file/d/${json.id}/view`;
}
