import { NextResponse, type NextRequest } from "next/server";

// 管理画面は Basic 認証で保護する (ADMIN_PASSWORD 未設定時は開発用に素通し)。
// ドライバーポータル (/portal)・LINE からの入口 (/liff)・OCR API はトークンで個別に認可するため対象外。
export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER ?? "admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("ADMIN_PASSWORD is not configured", { status: 503 });
    }
    return NextResponse.next();
  }

  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [u, ...rest] = atob(encoded).split(":");
    if (u === user && rest.join(":") === password) return NextResponse.next();
  }
  return new NextResponse("認証が必要です", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="FleetManager", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!portal|liff|api/ocr|api/mock-files|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
