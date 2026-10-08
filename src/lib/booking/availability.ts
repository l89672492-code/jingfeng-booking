/**
 * 將資料庫回傳的「場地 × 時段」狀態整理成畫面需要的格式。
 * 時段本身由資料庫依營業時間與 slot_duration_minutes 產生，這裡不寫死任何時間。
 */
import type { DayAvailabilityRow, SlotStatus } from "@/types/database";

export type TimeSlotSummary = {
  startTime: string;
  endTime: string;
  price: number | null;
  availableCount: number;
  courtCount: number;
};

export type CourtSlot = {
  courtId: string;
  courtName: string;
  status: SlotStatus;
  price: number | null;
};

/** 球友端顯示的四種狀態 */
export type DisplayStatus = "available" | "booked" | "unavailable" | "closed";

export function toDisplayStatus(status: SlotStatus): DisplayStatus {
  switch (status) {
    case "available":
      return "available";
    case "booked":
      return "booked";
    case "closed":
      return "closed";
    default:
      return "unavailable";
  }
}

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  available: "可預約",
  booked: "已預約",
  unavailable: "不可預約",
  closed: "休館",
};

/** 依時段彙總：每個時段還有幾面場可預約 */
export function summarizeTimeSlots(rows: DayAvailabilityRow[]): TimeSlotSummary[] {
  const slots = new Map<string, TimeSlotSummary>();
  for (const row of rows) {
    let slot = slots.get(row.start_time);
    if (!slot) {
      slot = {
        startTime: row.start_time,
        endTime: row.end_time,
        price: null,
        availableCount: 0,
        courtCount: 0,
      };
      slots.set(row.start_time, slot);
    }
    slot.courtCount += 1;
    if (row.status === "available") {
      slot.availableCount += 1;
      slot.price = row.price;
    } else if (slot.price === null && row.price !== null) {
      slot.price = row.price;
    }
  }
  return [...slots.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** 某個時段每一面場的狀態（依場地排序） */
export function courtsForSlot(rows: DayAvailabilityRow[], startTime: string): CourtSlot[] {
  return rows
    .filter((row) => row.start_time === startTime)
    .sort((a, b) => a.sort_order - b.sort_order || a.court_name.localeCompare(b.court_name))
    .map((row) => ({
      courtId: row.court_id,
      courtName: row.court_name,
      status: row.status,
      price: row.price,
    }));
}
