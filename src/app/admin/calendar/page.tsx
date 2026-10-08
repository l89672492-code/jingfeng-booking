import type { Metadata } from "next";
import Link from "next/link";

import { cardClass } from "@/components/ui/styles";
import {
  addDays,
  dayOfWeek,
  formatDateWithWeekday,
  formatTime,
  isValidIsoDate,
  monthRange,
  shiftMonth,
  taipeiToday,
} from "@/lib/booking/dates";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/status";
import { getBookings, getCourts, type BookingWithCourt } from "@/server/admin/bookings";
import { requireStaff } from "@/server/auth";
import { getDayAvailability } from "@/server/availability";
import type { DayAvailabilityRow } from "@/types/database";

import { AdminPage } from "../_components/admin-page";

export const metadata: Metadata = { title: "場地表" };

const BOOKING_CELL: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 hover:bg-amber-200",
  confirmed: "bg-brand-100 text-brand-900 hover:bg-brand-200",
  completed: "bg-zinc-200 text-zinc-700 hover:bg-zinc-300",
};

function MonthOverview({
  date,
  today,
  counts,
}: {
  date: string;
  today: string;
  counts: Map<string, number>;
}) {
  const month = date.slice(0, 7);
  const { from, to } = monthRange(month);
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);

  return (
    <section className={cardClass}>
      <div className="mb-3 flex items-center justify-between">
        <Link href={`/admin/calendar?date=${shiftMonth(month, -1)}-01`} className="px-2 text-lg" aria-label="上個月">
          ‹
        </Link>
        <h2 className="font-bold">
          {month.replace("-", "年")}月
        </h2>
        <Link href={`/admin/calendar?date=${shiftMonth(month, 1)}-01`} className="px-2 text-lg" aria-label="下個月">
          ›
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["日", "一", "二", "三", "四", "五", "六"].map((label) => (
          <div key={label} className="py-1 text-zinc-500">
            {label}
          </div>
        ))}
        {Array.from({ length: dayOfWeek(from) }, (_, index) => (
          <div key={`blank-${index}`} />
        ))}
        {days.map((day) => {
          const count = counts.get(day) ?? 0;
          const selected = day === date;
          return (
            <Link
              key={day}
              href={`/admin/calendar?date=${day}`}
              className={`flex flex-col items-center rounded-lg py-1 ${
                selected
                  ? "bg-brand-600 text-white"
                  : day === today
                    ? "border border-accent-500"
                    : "hover:bg-zinc-100"
              }`}
            >
              <span className="text-sm">{Number(day.slice(8))}</span>
              <span className={`text-[10px] ${selected ? "text-brand-100" : count ? "text-brand-700" : "text-transparent"}`}>
                {count}筆
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

async function CalendarContent({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireStaff();
  const today = taipeiToday();
  const { date: requested } = await searchParams;
  const date = requested && isValidIsoDate(requested) ? requested : today;
  const month = monthRange(date.slice(0, 7));

  const [courts, monthBookings, availability] = await Promise.all([
    getCourts(),
    getBookings({ from: month.from, to: month.to }),
    getDayAvailability(date).catch((error): DayAvailabilityRow[] => {
      console.error("[admin/calendar]", error);
      return [];
    }),
  ]);

  const active = monthBookings.filter((booking) => booking.status !== "cancelled");
  const counts = new Map<string, number>();
  for (const booking of active) {
    counts.set(booking.booking_date, (counts.get(booking.booking_date) ?? 0) + 1);
  }
  const dayBookings = active.filter((booking) => booking.booking_date === date);

  // 時段來自資料庫（營業時間 × 租借單位），不在畫面寫死
  const slots = [...new Map(availability.map((row) => [row.start_time, row.end_time])).entries()];
  const statusOf = new Map(availability.map((row) => [`${row.court_id}@${row.start_time}`, row.status]));

  function bookingAt(courtId: string, start: string): BookingWithCourt | undefined {
    return dayBookings.find(
      (booking) => booking.court_id === courtId && booking.start_time <= start && booking.end_time > start,
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
      <section className={`${cardClass} overflow-x-auto`}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link href={`/admin/calendar?date=${addDays(date, -1)}`} className="rounded-lg border border-zinc-300 px-3 py-1">
            ‹ 前一天
          </Link>
          <Link href={`/admin/calendar?date=${today}`} className="rounded-lg border border-zinc-300 px-3 py-1">
            今天
          </Link>
          <Link href={`/admin/calendar?date=${addDays(date, 1)}`} className="rounded-lg border border-zinc-300 px-3 py-1">
            後一天 ›
          </Link>
          <form className="flex items-center gap-2" action="/admin/calendar">
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="rounded-lg border border-zinc-300 px-2 py-1"
              aria-label="選擇日期"
            />
            <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1 text-white">
              前往
            </button>
          </form>
          <p className="ml-auto font-bold">{formatDateWithWeekday(date)}</p>
        </div>

        {slots.length === 0 ? (
          <p className="py-6 text-center text-zinc-500">這天不營業。</p>
        ) : (
          <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-20 border-b border-zinc-200 py-2 text-left font-medium text-zinc-500">時間</th>
                {courts.map((court) => (
                  <th key={court.id} className="border-b border-zinc-200 py-2 font-bold">
                    {court.name}
                    {court.status !== "active" && <span className="ml-1 text-xs font-normal text-zinc-400">停用</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map(([start]) => (
                <tr key={start}>
                  <td className="border-b border-zinc-100 py-1 pr-2 align-top text-zinc-600">
                    {formatTime(start)}
                  </td>
                  {courts.map((court) => {
                    const booking = bookingAt(court.id, start);
                    const status = statusOf.get(`${court.id}@${start}`);
                    return (
                      <td key={court.id} className="border-b border-zinc-100 p-1">
                        {booking ? (
                          <Link
                            href={`/admin/bookings/${booking.id}`}
                            className={`block rounded-lg px-2 py-1.5 ${BOOKING_CELL[booking.status] ?? ""}`}
                            title={`${booking.booking_number} ${booking.customer_name} ${booking.customer_phone}`}
                          >
                            <span className="block truncate font-medium">預約 {booking.customer_name}</span>
                            <span className="block truncate text-[11px] opacity-75">
                              {BOOKING_STATUS_LABELS[booking.status]}
                            </span>
                          </Link>
                        ) : status === "available" ? (
                          <Link
                            href={`/admin/bookings/new?date=${date}&start=${formatTime(start)}&court=${court.id}`}
                            className="block rounded-lg border border-dashed border-green-300 px-2 py-1.5 text-green-700 hover:bg-green-50"
                          >
                            可租
                          </Link>
                        ) : (
                          <span className="block rounded-lg bg-zinc-50 px-2 py-1.5 text-zinc-400">
                            {status === "closed" ? "休館" : status === "blocked" ? "關閉" : "—"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          每列為一個開始時間（每 30 分鐘），預約會佔用它實際涵蓋的所有列。點擊預約可查看詳細資料；點擊「可租」可直接新增一小時的預約。
        </p>
      </section>

      <MonthOverview date={date} today={today} counts={counts} />
    </div>
  );
}

export default function AdminCalendarPage(props: PageProps<"/admin/calendar">) {
  return (
    <AdminPage title="場地表">
      <CalendarContent searchParams={props.searchParams as Promise<{ date?: string }>} />
    </AdminPage>
  );
}
