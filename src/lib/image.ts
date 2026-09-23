// クライアント側で写真を縮小してからアップロードする (通信量・Server Action のサイズ制限対策)。
// デコードできない形式 (一部ブラウザの HEIC 等) や PDF はそのまま返す。
export async function compressImage(file: File, maxSize = 1800, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 400 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
