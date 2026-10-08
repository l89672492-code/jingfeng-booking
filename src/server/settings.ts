import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

export type FacilityInfo = {
  name: string;
  phone: string;
  address: string;
  line: string;
  cancellationDeadlineHours: number;
  bookingMaxDaysAhead: number;
};

function toInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** 讀取公開的場館設定（system_settings 中 is_public = true 的項目） */
export async function getPublicSettings(): Promise<FacilityInfo> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("system_settings").select("key, value");
  if (error) throw error;

  const settings = new Map(data.map((row) => [row.key, row.value]));
  return {
    name: settings.get("facility_name") ?? "",
    phone: settings.get("facility_phone") ?? "",
    address: settings.get("facility_address") ?? "",
    line: settings.get("facility_line") ?? "",
    cancellationDeadlineHours: toInt(settings.get("cancellation_deadline_hours"), 2),
    bookingMaxDaysAhead: toInt(settings.get("booking_max_days_ahead"), 30),
  };
}

/** 讀取失敗時回傳 null（頁面改顯示提示，不讓整頁壞掉） */
export async function getPublicSettingsSafe(): Promise<FacilityInfo | null> {
  try {
    return await getPublicSettings();
  } catch (error) {
    console.error("[settings] 讀取場館設定失敗", error);
    return null;
  }
}
