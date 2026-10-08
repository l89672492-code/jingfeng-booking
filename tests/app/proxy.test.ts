import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  // 測試用的假設定；未登入時 Supabase client 不會發出任何網路請求
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

describe("後台路由保護（proxy）", () => {
  it("11. 未登入進入 /admin 會被導向 /login", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(new NextRequest("https://booking.test/admin"));
    expect([302, 307]).toContain(response.status);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  });

  it("11. 未登入進入任何後台子頁面也會被導向 /login", async () => {
    const { proxy } = await import("@/proxy");
    for (const path of ["/admin/calendar", "/admin/bookings/new", "/admin/pricing"]) {
      const response = await proxy(new NextRequest(`https://booking.test${path}`));
      expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
    }
  });

  it("偽造的登入 cookie 也無法通過", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("https://booking.test/admin", {
      headers: { cookie: "sb-example-auth-token=base64-eyJmYWtlIjp0cnVlfQ" },
    });
    const response = await proxy(request);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  });

  it("proxy 只套用在後台與登入頁", async () => {
    const { config } = await import("@/proxy");
    expect(config.matcher).toEqual(["/admin/:path*", "/login"]);
  });
});
