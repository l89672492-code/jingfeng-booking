"use client";

import { dayOfWeek } from "@/lib/booking/dates";
import type { DateStatus } from "@/types/database";

const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

export type DateOption = { date: string; status: DateStatus; holidayName: string | null };

type Props = {
  dates: DateOption[] | null;
  today: string;
  selectedDate: string | null;
  onSelect: (date: string) => void;
};

/** 可左右滑動的日期列（今天起到可預約的最後一天） */
export function DateStrip({ dates, today, selectedDate, onSelect }: Props) {
  if (!dates) {
    return <div className="h-[76px] animate-pulse rounded-xl bg-zinc-100" aria-label="載入日期中" />;
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <ul className="flex gap-2" aria-label="選擇日期">
        {dates.map(({ date, status }, index) => {
          const selectable = status === "open";
          const isSelected = date === selectedDate;
          const weekday = dayOfWeek(date);
          const isWeekend = weekday === 0 || weekday === 6;
          const showMonth = index === 0 || date.endsWith("-01");

          return (
            <li key={date} className="shrink-0">
              <button
                type="button"
                disabled={!selectable}
                onClick={() => onSelect(date)}
                aria-pressed={isSelected}
                aria-label={`${date}${status === "closed" ? " 休館" : ""}`}
                className={`flex h-[76px] w-14 flex-col items-center justify-center rounded-xl border text-center transition-colors ${
                  isSelected
                    ? "border-brand-600 bg-brand-600 text-white"
                    : selectable
                      ? "border-zinc-200 bg-white hover:border-brand-400"
                      : "border-zinc-100 bg-zinc-50 text-zinc-300"
                }`}
              >
                <span className={`text-[11px] leading-none ${isSelected ? "text-brand-100" : "text-zinc-400"}`}>
                  {showMonth ? `${Number(date.slice(5, 7))}月` : " "}
                </span>
                <span className="mt-1 text-lg font-bold leading-none">{Number(date.slice(8))}</span>
                <span
                  className={`mt-1 text-xs leading-none ${
                    isSelected ? "text-white" : isWeekend && selectable ? "text-accent-600" : ""
                  }`}
                >
                  {status === "closed" ? "休館" : date === today ? "今天" : WEEKDAY_SHORT[weekday]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
