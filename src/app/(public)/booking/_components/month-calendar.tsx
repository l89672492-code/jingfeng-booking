"use client";

import { addDays, dayOfWeek, monthRange } from "@/lib/booking/dates";
import type { DateStatus } from "@/types/database";

const WEEK_HEADERS = ["日", "一", "二", "三", "四", "五", "六"];

type Props = {
  month: string; // YYYY-MM
  today: string;
  statuses: Map<string, { status: DateStatus; holidayName: string | null }> | null;
  loading: boolean;
  selectedDate: string | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (date: string) => void;
};

export function MonthCalendar({
  month,
  today,
  statuses,
  loading,
  selectedDate,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onSelect,
}: Props) {
  const { from, to } = monthRange(month);
  const leadingBlanks = dayOfWeek(from);
  const days: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) days.push(date);

  const [year, monthNumber] = month.split("-");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          aria-label="上個月"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-300 bg-white text-xl disabled:opacity-30"
        >
          ‹
        </button>
        <p className="text-lg font-bold">
          {year}年{monthNumber}月
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label="下個月"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-300 bg-white text-xl disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {WEEK_HEADERS.map((label, index) => (
          <div
            key={label}
            className={`py-1 font-medium ${index === 0 || index === 6 ? "text-accent-600" : "text-zinc-500"}`}
          >
            {label}
          </div>
        ))}

        {Array.from({ length: leadingBlanks }, (_, index) => (
          <div key={`blank-${index}`} />
        ))}

        {days.map((date) => {
          const info = statuses?.get(date);
          const status = info?.status;
          const selectable = status === "open";
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const dayNumber = Number(date.slice(8));

          let className =
            "relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl text-base transition-colors";
          if (isSelected) {
            className += " bg-brand-600 font-bold text-white";
          } else if (selectable) {
            className += " bg-white border border-zinc-200 text-zinc-900 hover:border-brand-500 hover:bg-brand-50";
          } else {
            className += " text-zinc-300";
          }

          return (
            <button
              key={date}
              type="button"
              disabled={!selectable}
              onClick={() => onSelect(date)}
              className={className}
              aria-pressed={isSelected}
              aria-label={`${date}${status === "closed" ? " 休館" : ""}`}
            >
              <span>{dayNumber}</span>
              {status === "closed" && !isSelected && (
                <span className="text-[10px] leading-none text-red-400">休館</span>
              )}
              {isToday && !isSelected && (
                <span className="text-[10px] leading-none text-accent-600">今天</span>
              )}
            </button>
          );
        })}
      </div>

      {loading && <p className="mt-3 text-center text-sm text-zinc-500">載入中…</p>}
    </div>
  );
}
