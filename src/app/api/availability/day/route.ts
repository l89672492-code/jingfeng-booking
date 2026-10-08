import { NextResponse, type NextRequest } from "next/server";

import { isValidIsoDate } from "@/lib/booking/dates";
import { GENERIC_ERROR_MESSAGE } from "@/lib/booking/errors";
import { getDayAvailability } from "@/server/availability";

/** GET /api/availability/day?date=YYYY-MM-DD → 該日每個場地 × 時段的狀態與價格 */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";

  if (!isValidIsoDate(date)) {
    return NextResponse.json({ error: "日期格式不正確" }, { status: 400 });
  }

  try {
    const slots = await getDayAvailability(date);
    return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/availability/day]", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}
