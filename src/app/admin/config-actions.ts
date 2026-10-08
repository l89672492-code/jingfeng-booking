"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  blockedSlotSchema,
  businessHoursSchema,
  courtSchema,
  holidaySchema,
  pricingRuleSchema,
} from "@/lib/booking/validation";
import {
  createBlockedSlot,
  createHoliday,
  createPricingRule,
  deleteBlockedSlot,
  deleteHoliday,
  setPricingRuleActive,
  updateBusinessHours,
  updateCourt,
  updatePricingRule,
  updateSettings,
  type MutationResult,
} from "@/server/admin/config";
import { requireAdmin, requireStaff } from "@/server/auth";

/**
 * 後台設定的 Server Actions。
 * 每個 action 都重新驗證登入者權限（requireAdmin / requireStaff）與輸入資料，
 * 資料庫 RLS 也會再擋一次。
 */

function invalid(error: z.ZodError): MutationResult {
  return { ok: false, error: error.issues[0]?.message ?? "資料格式不正確" };
}

const NOT_FOUND: MutationResult = { ok: false, error: "找不到資料，請重新整理頁面。" };

function done(result: MutationResult): MutationResult {
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}

// ---------------------------------------------------------------- 價格
export async function savePricingRuleAction(id: string | null, input: unknown): Promise<MutationResult> {
  await requireAdmin();
  if (id !== null && !z.uuid().safeParse(id).success) return NOT_FOUND;
  const parsed = pricingRuleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return done(id ? await updatePricingRule(id, parsed.data) : await createPricingRule(parsed.data));
}

export async function togglePricingRuleAction(id: string, active: boolean): Promise<MutationResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  return done(await setPricingRuleActive(id, active === true));
}

// ---------------------------------------------------------------- 場地
export async function saveCourtAction(id: string, input: unknown): Promise<MutationResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  const parsed = courtSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return done(await updateCourt(id, parsed.data));
}

// ---------------------------------------------------------------- 關閉時段
export async function createBlockedSlotAction(input: unknown): Promise<MutationResult> {
  await requireStaff();
  const parsed = blockedSlotSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return done(await createBlockedSlot(parsed.data));
}

export async function deleteBlockedSlotAction(id: string): Promise<MutationResult> {
  await requireStaff();
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  return done(await deleteBlockedSlot(id));
}

// ---------------------------------------------------------------- 休館日
export async function createHolidayAction(input: unknown): Promise<MutationResult> {
  await requireAdmin();
  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return done(await createHoliday(parsed.data));
}

export async function deleteHolidayAction(id: string): Promise<MutationResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return NOT_FOUND;
  return done(await deleteHoliday(id));
}

// ---------------------------------------------------------------- 營業時間
export async function saveBusinessHoursAction(input: unknown): Promise<MutationResult> {
  await requireAdmin();
  const parsed = z.array(businessHoursSchema).length(7, "請設定星期日到星期六").safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const days = new Set(parsed.data.map((row) => row.dayOfWeek));
  if (days.size !== 7) return { ok: false, error: "請設定星期日到星期六" };
  return done(await updateBusinessHours(parsed.data));
}

// ---------------------------------------------------------------- 系統設定
const settingsSchema = z.object({
  cancellation_deadline_hours: z.coerce
    .number("請輸入數字")
    .int("請輸入整數")
    .min(0, "不可小於 0")
    .max(720, "最多 720 小時")
    .transform(String),
  booking_max_days_ahead: z.coerce
    .number("請輸入數字")
    .int("請輸入整數")
    .min(0, "不可小於 0")
    .max(365, "最多 365 天")
    .transform(String),
  facility_name: z.string().trim().min(1, "請輸入場館名稱").max(50),
  facility_phone: z.string().trim().min(1, "請輸入電話").max(30),
  facility_address: z.string().trim().min(1, "請輸入地址").max(100),
  facility_line: z.string().trim().min(1, "請輸入 LINE ID").max(50),
});

export async function saveSettingsAction(input: unknown): Promise<MutationResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await updateSettings(parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
