"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { BookingErrorCode } from "@/lib/booking/errors";
import { customerBookingSchema, fieldErrors } from "@/lib/booking/validation";
import { createBooking } from "@/server/bookings";

import { SUCCESS_COOKIE } from "./success-cookie";

export type SubmitBookingResult = {
  ok: false;
  error: string;
  code: BookingErrorCode | null;
  fieldErrors: Record<string, string>;
};

/**
 * 球友送出預約。
 * 1. 以 zod 重新驗證（前端驗證不可信；多傳的欄位例如 price 會被丟掉）
 * 2. 呼叫資料庫 create_booking()：再次檢查場地／日期／營業時間／休館／關閉時段，
 *    重新計算價格，並由排除約束保證不撞場
 * 3. 成功後把預約編號與手機存在 httpOnly cookie，導向成功頁
 */
export async function submitBooking(input: unknown): Promise<SubmitBookingResult> {
  const parsed = customerBookingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "請檢查填寫的資料。",
      code: null,
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const result = await createBooking(parsed.data);
  if (!result.ok) {
    return { ...result, fieldErrors: {} };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SUCCESS_COOKIE,
    JSON.stringify({ n: result.data.booking_number, p: result.data.customer_phone }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/booking/success",
      maxAge: 60 * 30,
    },
  );

  redirect("/booking/success");
}
