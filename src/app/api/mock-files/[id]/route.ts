import { getMockFile } from "@/lib/storage";

// デモモード専用: メモリ上に保存したアップロード画像を返す
export async function GET(_req: Request, ctx: RouteContext<"/api/mock-files/[id]">) {
  const { id } = await ctx.params;
  const f = getMockFile(id);
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.data), {
    headers: { "Content-Type": f.type, "Cache-Control": "private, max-age=3600" },
  });
}
