"use server";

import { bookingLookupSchema, fieldErrors } from "@/lib/booking/validation";
import { cancelBooking, getBookingByNumber } from "@/server/bookings";
import type { CustomerBookingRow } from "@/types/database";

export type MyBookingResult =
  | { ok: true; booking: CustomerBookingRow; message?: string }
  | { ok: false; error: string; fieldErrors: Record<string, string> };

const NOT_FOUND = "查無此預約，請確認預約編號與手機號碼。";

/** 以預約編號 + 手機查詢自己的預約 */
export async function lookupBooking(input: unknown): Promise<MyBookingResult> {
  const parsed = bookingLookupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "請檢查填寫的資料。", fieldErrors: fieldErrors(parsed.error) };
  }

  const result = await getBookingByNumber(parsed.data);
  if (!result.ok) return { ok: false, error: result.error, fieldErrors: {} };
  if (!result.data) return { ok: false, error: NOT_FOUND, fieldErrors: {} };
  return { ok: true, booking: result.data };
}

/** 取消自己的預約（server 端重新驗證編號、手機與取消期限） */
export async function cancelMyBooking(input: unknown): Promise<MyBookingResult> {
  const parsed = bookingLookupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "請檢查填寫的資料。", fieldErrors: fieldErrors(parsed.error) };
  }

  const cancelled = await cancelBooking(parsed.data);
  if (!cancelled.ok) return { ok: false, error: cancelled.error, fieldErrors: {} };

  const result = await getBookingByNumber(parsed.data);
  if (!result.ok || !result.data) return { ok: false, error: NOT_FOUND, fieldErrors: {} };
  return { ok: true, booking: result.data, message: "已取消預約，場地已釋出。" };
}
