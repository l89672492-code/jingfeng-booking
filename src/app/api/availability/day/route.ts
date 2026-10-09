import { NextResponse, type NextRequest } from "next/server";

import { isValidIsoDate } from "@/lib/booking/dates";
import { GENERIC_ERROR_MESSAGE } from "@/lib/booking/errors";
import { getDayAvailability } from "@/server/availability";

/**
 * GET /api/availability/day?date=YYYY-MM-DD&duration=分鐘
 * → 該日每個場地 × 開始時間的狀態與價格（duration 未指定則為最短租用時間）
 */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const durationParam = request.nextUrl.searchParams.get("duration");

  if (!isValidIsoDate(date)) {
    return NextResponse.json({ error: "日期格式不正確" }, { status: 400 });
  }

  let duration: number | undefined;
  if (durationParam !== null) {
    // 長度上下限由資料庫設定檢查，這裡只確認是合理的整數
    if (!/^\d{2,3}$/.test(durationParam)) {
      return NextResponse.json({ error: "租用時間不正確" }, { status: 400 });
    }
    duration = Number(durationParam);
  }

  try {
    const slots = await getDayAvailability(date, duration);
    return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error && typeof error === "object" && "message" in error && error.message === "INVALID_INPUT") {
      return NextResponse.json({ error: "租用時間不正確" }, { status: 400 });
    }
    console.error("[api/availability/day]", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}
