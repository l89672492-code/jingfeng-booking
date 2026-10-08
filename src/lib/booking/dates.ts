/**
 * 日期工具。系統一律以台灣時間（Asia/Taipei）判斷「今天」。
 * 日期字串格式為 ISO：YYYY-MM-DD。
 */

export const TIME_ZONE = "Asia/Taipei";

const WEEKDAY_NAMES = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
] as const;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 台灣時間的今天（YYYY-MM-DD） */
export function taipeiToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 檢查是否為合法的 YYYY-MM-DD 日期 */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

export function addDays(isoDate: string, days: number): string {
  const date = toUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 0 = 星期日 … 6 = 星期六 */
export function dayOfWeek(isoDate: string): number {
  return toUtcDate(isoDate).getUTCDay();
}

export function weekdayName(isoDate: string): string {
  return WEEKDAY_NAMES[dayOfWeek(isoDate)];
}

/** 2026-10-15 → 2026年10月15日 */
export function formatDateZh(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${year}年${month}月${day}日`;
}

/** 2026-10-15 → 2026年10月15日（星期四） */
export function formatDateWithWeekday(isoDate: string): string {
  return `${formatDateZh(isoDate)}（${weekdayName(isoDate)}）`;
}

/** 某月份的第一天與最後一天，month 格式 YYYY-MM */
export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  const next = toUtcDate(from);
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(0);
  return { from, to: next.toISOString().slice(0, 10) };
}

export function shiftMonth(month: string, delta: number): string {
  const date = toUtcDate(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

/** 該週星期一（以星期一為一週開始） */
export function startOfWeek(isoDate: string): string {
  const offset = (dayOfWeek(isoDate) + 6) % 7;
  return addDays(isoDate, -offset);
}

/** "19:00:00" → "19:00" */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/** "19:00:00", "20:00:00" → "19:00–20:00" */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}
