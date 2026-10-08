"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getErrorMessage } from "@/lib/booking/errors";
import { adminBookingSchema, fieldErrors } from "@/lib/booking/validation";
import { cancelBookingAsAdmin, createAdminBooking, updateBooking } from "@/server/admin/bookings";
import { requireStaff } from "@/server/auth";
import { calculateBookingPrice } from "@/server/availability";

export type SaveBookingResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors: Record<string, string> };

/** 新增（id = null）或修改預約。權限、撞場、營業時間等由 server 與資料庫重新檢查 */
export async function saveBookingAction(
  id: string | null,
  input: unknown,
): Promise<SaveBookingResult> {
  await requireStaff();

  if (id !== null && !z.uuid().safeParse(id).success) {
    return { ok: false, error: "找不到這筆預約。", fieldErrors: {} };
  }

  const parsed = adminBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "請檢查填寫的資料。", fieldErrors: fieldErrors(parsed.error) };
  }

  const result = id ? await updateBooking(id, parsed.data) : await createAdminBooking(parsed.data);
  if (!result.ok) return { ok: false, error: result.error, fieldErrors: {} };

  revalidatePath("/admin", "layout");
  return { ok: true, id: result.data.id };
}

export async function cancelBookingAction(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireStaff();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "找不到這筆預約。" };

  const result = await cancelBookingAsAdmin(id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** 依價格規則試算費用（後台表單「依價格規則計算」按鈕） */
export async function previewPriceAction(
  date: string,
  startTime: string,
  endTime: string,
): Promise<{ price: number | null; error?: string }> {
  await requireStaff();
  const parsed = z
    .object({
      date: z.iso.date(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .safeParse({ date, startTime, endTime });
  if (!parsed.success) return { price: null, error: "請先選擇日期與時間。" };

  try {
    const price = await calculateBookingPrice(date, startTime, endTime);
    return price === null ? { price: null, error: "這個時段沒有對應的價格規則。" } : { price };
  } catch (error) {
    return { price: null, error: getErrorMessage(error) };
  }
}
