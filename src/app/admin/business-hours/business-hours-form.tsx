"use client";

import { useState } from "react";

import { buttonBrand } from "@/components/ui/styles";
import { formatTime } from "@/lib/booking/dates";
import { hourlyOptions } from "@/lib/booking/time-options";
import type { BusinessHoursRow } from "@/types/database";

import { MessageText, useMutation } from "../_components/use-mutation";
import { saveBusinessHoursAction } from "../config-actions";

const DAY_LABELS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
// 以星期一為第一列顯示
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HOURS = hourlyOptions();
const cell = "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 disabled:opacity-40";

type Row = { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean };

export function BusinessHoursForm({ initial }: { initial: BusinessHoursRow[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    DISPLAY_ORDER.map((day) => {
      const existing = initial.find((row) => row.day_of_week === day);
      return {
        dayOfWeek: day,
        openTime: existing ? formatTime(existing.open_time) : "09:00",
        closeTime: existing ? formatTime(existing.close_time) : "22:00",
        isOpen: existing?.is_open ?? false,
      };
    }),
  );
  const { isPending, message, run } = useMutation();

  function update(day: number, patch: Partial<Row>) {
    setRows((previous) => previous.map((row) => (row.dayOfWeek === day ? { ...row, ...patch } : row)));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveBusinessHoursAction(rows), { successText: "已儲存營業時間" });
      }}
    >
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 text-left text-zinc-500">
          <tr>
            <th className="py-2 pr-3 font-medium">星期</th>
            <th className="py-2 pr-3 font-medium">營業</th>
            <th className="py-2 pr-3 font-medium">開門</th>
            <th className="py-2 font-medium">打烊</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.dayOfWeek} className="border-b border-zinc-100">
              <td className="py-2 pr-3 font-medium">{DAY_LABELS[row.dayOfWeek]}</td>
              <td className="py-2 pr-3">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={row.isOpen}
                  aria-label={`${DAY_LABELS[row.dayOfWeek]}營業`}
                  onChange={(e) => update(row.dayOfWeek, { isOpen: e.target.checked })}
                />
              </td>
              <td className="py-2 pr-3">
                <select
                  className={cell}
                  value={row.openTime}
                  disabled={!row.isOpen}
                  aria-label={`${DAY_LABELS[row.dayOfWeek]}開門時間`}
                  onChange={(e) => update(row.dayOfWeek, { openTime: e.target.value })}
                >
                  {HOURS.slice(0, -1).map((hour) => <option key={hour}>{hour}</option>)}
                </select>
              </td>
              <td className="py-2">
                <select
                  className={cell}
                  value={row.closeTime}
                  disabled={!row.isOpen}
                  aria-label={`${DAY_LABELS[row.dayOfWeek]}打烊時間`}
                  onChange={(e) => update(row.dayOfWeek, { closeTime: e.target.value })}
                >
                  {HOURS.slice(1).map((hour) => <option key={hour}>{hour}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonBrand} disabled={isPending}>
          {isPending ? "儲存中…" : "儲存營業時間"}
        </button>
        <MessageText message={message} />
      </div>
    </form>
  );
}
