import type { Metadata } from "next";
import Link from "next/link";

import { buttonPrimary, cardClass } from "@/components/ui/styles";
import { addDays, formatDateWithWeekday, formatTimeRange, isValidIsoDate, taipeiToday } from "@/lib/booking/dates";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES } from "@/lib/booking/status";
import { BOOKING_STATUSES } from "@/lib/booking/validation";
import { completeFinishedBookings, getBookings } from "@/server/admin/bookings";
import { requireStaff } from "@/server/auth";
import type { BookingStatus } from "@/types/database";

import { AdminPage } from "../_components/admin-page";

export const metadata: Metadata = { title: "預約列表" };

type Search = { from?: string; to?: string; status?: string; q?: string };

async function BookingList({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaff();
  await completeFinishedBookings();

  const params = await searchParams;
  const today = taipeiToday();
  const from = params.from && isValidIsoDate(params.from) ? params.from : today;
  const to = params.to && isValidIsoDate(params.to) && params.to >= from ? params.to : addDays(from, 30);
  const status = BOOKING_STATUSES.includes(params.status as BookingStatus)
    ? (params.status as BookingStatus)
    : undefined;
  const keyword = (params.q ?? "").trim().slice(0, 50);

  const bookings = await getBookings({ from, to, status, keyword });
  const inputClass = "rounded-lg border border-zinc-300 bg-white px-2 py-1.5";

  return (
    <div className="space-y-4">
      <form action="/admin/bookings" className={`${cardClass} flex flex-wrap items-end gap-3 text-sm`}>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">開始日期</span>
          <input type="date" name="from" defaultValue={from} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">結束日期</span>
          <input type="date" name="to" defaultValue={to} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">狀態</span>
          <select name="status" defaultValue={status ?? ""} className={inputClass}>
            <option value="">全部</option>
            {BOOKING_STATUSES.map((value) => (
              <option key={value} value={value}>
                {BOOKING_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">搜尋</span>
          <input
            type="search"
            name="q"
            defaultValue={keyword}
            placeholder="編號、姓名或電話"
            className={inputClass}
          />
        </label>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-1.5 font-medium text-white">
          篩選
        </button>
      </form>

      <section className={`${cardClass} overflow-x-auto`}>
        <p className="mb-3 text-sm text-zinc-500">共 {bookings.length} 筆{bookings.length === 500 && "（最多顯示 500 筆，請縮小範圍）"}</p>
        {bookings.length === 0 ? (
          <p className="py-6 text-center text-zinc-500">沒有符合條件的預約。</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-medium">預約編號</th>
                <th className="py-2 pr-3 font-medium">日期</th>
                <th className="py-2 pr-3 font-medium">時間</th>
                <th className="py-2 pr-3 font-medium">場地</th>
                <th className="py-2 pr-3 font-medium">姓名</th>
                <th className="py-2 pr-3 font-medium">電話</th>
                <th className="py-2 pr-3 font-medium">費用</th>
                <th className="py-2 font-medium">狀態</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/bookings/${booking.id}`} className="font-medium text-brand-700 underline">
                      {booking.booking_number}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{formatDateWithWeekday(booking.booking_date)}</td>
                  <td className="py-2 pr-3">{formatTimeRange(booking.start_time, booking.end_time)}</td>
                  <td className="py-2 pr-3">{booking.court_name}</td>
                  <td className="py-2 pr-3">{booking.customer_name}</td>
                  <td className="py-2 pr-3">{booking.customer_phone}</td>
                  <td className="py-2 pr-3">{booking.price.toLocaleString("zh-TW")}元</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${BOOKING_STATUS_STYLES[booking.status]}`}>
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default function AdminBookingsPage(props: PageProps<"/admin/bookings">) {
  return (
    <AdminPage
      title="預約列表"
      actions={
        <Link href="/admin/bookings/new" className={buttonPrimary}>
          ＋ 新增預約
        </Link>
      }
    >
      <BookingList searchParams={props.searchParams as Promise<Search>} />
    </AdminPage>
  );
}
