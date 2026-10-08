import { NextResponse, type NextRequest } from "next/server";

import { isValidIsoDate } from "@/lib/booking/dates";
import { GENERIC_ERROR_MESSAGE } from "@/lib/booking/errors";
import { getDateStatuses } from "@/server/availability";

/** GET /api/availability/dates?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";

  if (!isValidIsoDate(from) || !isValidIsoDate(to) || to < from) {
    return NextResponse.json({ error: "日期格式不正確" }, { status: 400 });
  }

  try {
    const dates = await getDateStatuses(from, to);
    return NextResponse.json({ dates }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/availability/dates]", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}
