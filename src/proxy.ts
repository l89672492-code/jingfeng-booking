import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * 後台路由的第一道檢查：未登入直接導向 /login。
 * 這只是「樂觀檢查」；真正的權限驗證在每個後台頁面與 Server Action 內
 * （requireStaff / requireAdmin）以及資料庫 RLS 中執行。
 */
export async function proxy(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");

  try {
    const { response, userId } = await updateSession(request);
    if (isAdminRoute && !userId) {
      return NextResponse.redirect(loginUrl);
    }
    return response;
  } catch (error) {
    console.error("[proxy] session check failed", error);
    return isAdminRoute ? NextResponse.redirect(loginUrl) : NextResponse.next();
  }
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
