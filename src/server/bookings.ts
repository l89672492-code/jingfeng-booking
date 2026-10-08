import "server-only";

import { getErrorCode, getErrorMessage, type BookingErrorCode } from "@/lib/booking/errors";
import type { BookingLookupInput, CustomerBookingInput } from "@/lib/booking/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingRow, CustomerBookingRow } from "@/types/database";

/**
 * 球友端預約操作。
 * 這些資料庫函式只開放給 service_role，因此使用 secret key 的 admin client，
 * 而且只會在 server 端執行（server-only）。
 */

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: BookingErrorCode | null };

export function failure(error: unknown, context: string): { ok: false; error: string; code: BookingErrorCode | null } {
  const code = getErrorCode(error);
  if (!code) {
    // 未預期的錯誤只寫入 server log，不回傳技術細節給使用者
    console.error(`[${context}]`, error);
  }
  return { ok: false, error: getErrorMessage(error), code };
}

/**
 * 建立預約。
 * 刻意不接受 price：價格由資料庫 create_booking() 依價格規則重新計算。
 */
export async function createBooking(
  input: CustomerBookingInput,
): Promise<ActionResult<BookingRow>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("create_booking", {
      p_court_id: input.courtId,
      p_booking_date: input.date,
      p_start_time: input.startTime,
      p_end_time: input.endTime,
      p_customer_name: input.name,
      p_customer_phone: input.phone,
      p_customer_email: input.email ?? null,
      p_note: input.note ?? null,
    });
    if (error) return failure(error, "createBooking");
    return { ok: true, data };
  } catch (error) {
    return failure(error, "createBooking");
  }
}

/** 以預約編號 + 手機查詢（兩者都必須相符） */
export async function getBookingByNumber(
  input: BookingLookupInput,
): Promise<ActionResult<CustomerBookingRow | null>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_customer_booking", {
      p_booking_number: input.bookingNumber,
      p_phone: input.phone,
    });
    if (error) return failure(error, "getBookingByNumber");
    return { ok: true, data: data[0] ?? null };
  } catch (error) {
    return failure(error, "getBookingByNumber");
  }
}

/** 球友取消預約（取消期限由 cancellation_deadline_hours 設定） */
export async function cancelBooking(input: BookingLookupInput): Promise<ActionResult<null>> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("cancel_customer_booking", {
      p_booking_number: input.bookingNumber,
      p_phone: input.phone,
    });
    if (error) return failure(error, "cancelBooking");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error, "cancelBooking");
  }
}
