import { describe, expect, it } from "vitest";

import { courtsForSlot, summarizeTimeSlots, toDisplayStatus } from "@/lib/booking/availability";
import {
  addDays,
  formatDateWithWeekday,
  formatDateZh,
  isValidIsoDate,
  monthRange,
  startOfWeek,
  taipeiToday,
} from "@/lib/booking/dates";
import type { DayAvailabilityRow } from "@/types/database";

describe("日期工具", () => {
  it("日期格式 YYYY年MM月DD日 與星期", () => {
    expect(formatDateZh("2026-10-15")).toBe("2026年10月15日");
    expect(formatDateWithWeekday("2026-10-15")).toBe("2026年10月15日（星期四）");
    expect(formatDateWithWeekday("2026-10-18")).toBe("2026年10月18日（星期日）");
  });

  it("以台灣時間判斷今天", () => {
    // 2026-10-14 16:30 UTC = 台灣 2026-10-15 00:30
    expect(taipeiToday(new Date("2026-10-14T16:30:00Z"))).toBe("2026-10-15");
    expect(taipeiToday(new Date("2026-10-14T15:30:00Z"))).toBe("2026-10-14");
  });

  it("日期運算", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
  });
});

describe("可預約狀態整理", () => {
  const row = (court: string, sort: number, start: string, status: DayAvailabilityRow["status"]): DayAvailabilityRow => ({
    court_id: court,
    court_name: `${court}場`,
    sort_order: sort,
    start_time: start,
    end_time: `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00:00`,
    status,
    price: 500,
  });

  const rows = [
    row("B", 2, "19:00:00", "available"),
    row("A", 1, "19:00:00", "booked"),
    row("A", 1, "20:00:00", "blocked"),
    row("B", 2, "20:00:00", "past"),
  ];

  it("依時段彙總可預約場地數", () => {
    const slots = summarizeTimeSlots(rows);
    expect(slots.map((slot) => [slot.startTime, slot.availableCount, slot.courtCount])).toEqual([
      ["19:00:00", 1, 2],
      ["20:00:00", 0, 2],
    ]);
  });

  it("場地依排序顯示", () => {
    expect(courtsForSlot(rows, "19:00:00").map((court) => court.courtName)).toEqual(["A場", "B場"]);
  });

  it("球友端只顯示四種狀態", () => {
    expect(toDisplayStatus("available")).toBe("available");
    expect(toDisplayStatus("booked")).toBe("booked");
    expect(toDisplayStatus("blocked")).toBe("unavailable");
    expect(toDisplayStatus("past")).toBe("unavailable");
    expect(toDisplayStatus("closed")).toBe("closed");
  });
});
