import "server-only";

import type { z } from "zod";

import type {
  blockedSlotSchema,
  businessHoursSchema,
  courtSchema,
  holidaySchema,
  PricingRuleInput,
} from "@/lib/booking/validation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/server/auth";
import type {
  BlockedSlotRow,
  BusinessHoursRow,
  HolidayRow,
  PricingRuleRow,
  SystemSettingRow,
} from "@/types/database";

/**
 * 後台設定類資料（價格、場地、關閉時段、休館日、營業時間、系統設定）。
 * 寫入權限由 RLS 控管：關閉時段 staff 可改，其餘僅 admin。
 */

export type MutationResult = { ok: true } | { ok: false; error: string };

const SAVE_FAILED = "儲存失敗，請稍後再試。";

function toResult(error: { code?: string; message: string } | null, context: string): MutationResult {
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, error: "資料重複，請檢查後再試。" };
  console.error(`[${context}]`, error);
  return { ok: false, error: SAVE_FAILED };
}

// ---------------------------------------------------------------- 價格
export async function getPricingRules(): Promise<PricingRuleRow[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .order("day_type")
    .order("special_date", { nullsFirst: true })
    .order("start_time");
  if (error) throw error;
  return data;
}

function pricingRow(input: PricingRuleInput) {
  return {
    day_type: input.dayType,
    special_date: input.dayType === "special" ? (input.specialDate ?? null) : null,
    start_time: input.startTime,
    end_time: input.endTime,
    price: input.price,
    active: input.active,
  };
}

export async function createPricingRule(input: PricingRuleInput): Promise<MutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("pricing_rules").insert(pricingRow(input));
  return toResult(error, "createPricingRule");
}

export async function updatePricingRule(id: string, input: PricingRuleInput): Promise<MutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("pricing_rules").update(pricingRow(input)).eq("id", id);
  return toResult(error, "updatePricingRule");
}

export async function setPricingRuleActive(id: string, active: boolean): Promise<MutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("pricing_rules").update({ active }).eq("id", id);
  return toResult(error, "setPricingRuleActive");
}

// ---------------------------------------------------------------- 場地
export async function updateCourt(
  id: string,
  input: z.infer<typeof courtSchema>,
): Promise<MutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("courts")
    .update({ name: input.name, sort_order: input.sortOrder, status: input.status })
    .eq("id", id);
  return toResult(error, "updateCourt");
}

// ---------------------------------------------------------------- 關閉時段
export async function getBlockedSlots(fromDate: string): Promise<BlockedSlotRow[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocked_slots")
    .select("*")
    .gte("blocked_date", fromDate)
    .order("blocked_date")
    .order("start_time", { nullsFirst: true });
  if (error) throw error;
  return data;
}

export async function createBlockedSlot(
  input: z.infer<typeof blockedSlotSchema>,
): Promise<MutationResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_slots").insert({
    court_id: input.courtId ?? null,
    blocked_date: input.date,
    start_time: input.allDay ? null : (input.startTime ?? null),
    end_time: input.allDay ? null : (input.endTime ?? null),
    reason: input.reason,
  });
  return toResult(error, "createBlockedSlot");
}

export async function deleteBlockedSlot(id: string): Promise<MutationResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
  return toResult(error, "deleteBlockedSlot");
}

// ---------------------------------------------------------------- 休館日
export async function getHolidays(fromDate: string): Promise<HolidayRow[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holidays")
    .select("*")
    .gte("holiday_date", fromDate)
    .order("holiday_date");
  if (error) throw error;
  return data;
}

export async function createHoliday(input: z.infer<typeof holidaySchema>): Promise<MutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").insert({
    holiday_date: input.date,
    name: input.name,
    is_closed: input.isClosed,
    day_type: input.isClosed ? null : input.dayType,
  });
  if (error?.code === "23505") return { ok: false, error: "這個日期已經設定過，請先刪除再新增。" };
  return toResult(error, "createHoliday");
}

export async function deleteHoliday(id: string): Promise<MutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").delete().eq("id", id);
  return toResult(error, "deleteHoliday");
}

// ---------------------------------------------------------------- 營業時間
export async function getBusinessHours(): Promise<BusinessHoursRow[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("business_hours").select("*").order("day_of_week");
  if (error) throw error;
  return data;
}

export async function updateBusinessHours(
  rows: z.infer<typeof businessHoursSchema>[],
): Promise<MutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("business_hours").upsert(
    rows.map((row) => ({
      day_of_week: row.dayOfWeek,
      open_time: row.openTime,
      close_time: row.closeTime,
      is_open: row.isOpen,
    })),
    { onConflict: "day_of_week" },
  );
  return toResult(error, "updateBusinessHours");
}

// ---------------------------------------------------------------- 系統設定
export async function getAllSettings(): Promise<SystemSettingRow[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("system_settings").select("*").order("key");
  if (error) throw error;
  return data;
}

export async function updateSettings(values: Record<string, string>): Promise<MutationResult> {
  await requireAdmin();
  const supabase = await createClient();
  for (const [key, value] of Object.entries(values)) {
    const { error } = await supabase.from("system_settings").update({ value }).eq("key", key);
    if (error) return toResult(error, "updateSettings");
  }
  return { ok: true };
}
