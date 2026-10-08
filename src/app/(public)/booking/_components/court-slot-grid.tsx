"use client";

import { courtsForSlot, summarizeTimeSlots, toDisplayStatus } from "@/lib/booking/availability";
import { formatTime } from "@/lib/booking/dates";
import type { DayAvailabilityRow } from "@/types/database";

type Props = {
  rows: DayAvailabilityRow[];
  selected: { courtId: string; startTime: string } | null;
  onSelect: (courtId: string, startTime: string) => void;
};

/**
 * 時段 × 場地表格：一列一個時段、一欄一面場，點一格即同時選好時間與場地。
 * 時段與場地都來自資料庫，不寫死。
 */
export function CourtSlotGrid({ rows, selected, onSelect }: Props) {
  const slots = summarizeTimeSlots(rows);
  const courts = slots.length > 0 ? courtsForSlot(rows, slots[0].startTime) : [];

  if (slots.length === 0) {
    return <p className="py-8 text-center text-zinc-500">這天沒有開放預約的時段。</p>;
  }
  if (rows.every((row) => row.status === "closed")) {
    return <p className="rounded-xl bg-zinc-100 p-4 text-center text-zinc-600">這天休館。</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-green-400 bg-white" /> 可預約
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-brand-600" /> 已選擇
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-red-100" /> 已預約
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-zinc-200" /> 不可預約
        </span>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-14 text-left text-xs font-medium text-zinc-500">時間</th>
            {courts.map((court) => (
              <th key={court.courtId} className="font-bold text-zinc-800">
                {court.courtName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.startTime}>
              <td className="pr-1 align-middle text-xs leading-tight text-zinc-600">
                <span className="block font-bold text-zinc-800">{formatTime(slot.startTime)}</span>
                <span className="text-zinc-400">–{formatTime(slot.endTime)}</span>
              </td>
              {courtsForSlot(rows, slot.startTime).map((court) => {
                const display = toDisplayStatus(court.status);
                const isSelected =
                  selected?.courtId === court.courtId && selected.startTime === slot.startTime;
                const label = `${court.courtName} ${formatTime(slot.startTime)}`;

                if (display === "available") {
                  return (
                    <td key={court.courtId}>
                      <button
                        type="button"
                        onClick={() => onSelect(court.courtId, slot.startTime)}
                        aria-pressed={isSelected}
                        aria-label={`${label} 可預約`}
                        className={`flex h-11 w-full items-center justify-center rounded-lg border text-base font-bold transition-colors ${
                          isSelected
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-green-400 bg-white text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {isSelected ? "✓" : "○"}
                      </button>
                    </td>
                  );
                }

                return (
                  <td key={court.courtId}>
                    <span
                      aria-label={`${label} ${display === "booked" ? "已預約" : display === "closed" ? "休館" : "不可預約"}`}
                      className={`flex h-11 w-full items-center justify-center rounded-lg text-[11px] ${
                        display === "booked" ? "bg-red-100 text-red-700" : "bg-zinc-200 text-zinc-500"
                      }`}
                    >
                      {display === "booked" ? "已預約" : display === "closed" ? "休館" : "—"}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
