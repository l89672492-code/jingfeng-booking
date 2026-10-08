import "server-only";

import { courtsForSlot, summarizeTimeSlots } from "@/lib/booking/availability";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * 公開的可預約資訊。全部以訪客權限（publishable key）查詢，
 * 資料庫函式只回傳狀態與價格，不含任何顧客資料。
 */

/** 月曆：每天是否可預約 */
export async function getDateStatuses(from: string, to: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_date_statuses", { p_from: from, p_to: to });
  if (error) throw error;
  return data;
}

/** 某天所有場地 × 時段的狀態 */
export async function getDayAvailability(date: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_day_availability", { p_date: date });
  if (error) throw error;
  return data;
}

/** 某天的時段（含可預約場地數與價格） */
export async function getAvailableTimeSlots(date: string) {
  return summarizeTimeSlots(await getDayAvailability(date));
}

/** 某天某時段各場地的狀態 */
export async function getAvailableCourts(date: string, startTime: string) {
  return courtsForSlot(await getDayAvailability(date), startTime);
}

/** 依資料庫價格規則計算費用（找不到規則回傳 null） */
export async function calculateBookingPrice(date: string, startTime: string, endTime: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("calculate_price", {
    p_date: date,
    p_start: startTime,
    p_end: endTime,
  });
  if (error) throw error;
  return data;
}
