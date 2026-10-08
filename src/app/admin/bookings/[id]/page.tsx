import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { cardClass } from "@/components/ui/styles";
import { formatDateWithWeekday, formatTime, formatTimeRange } from "@/lib/booking/dates";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES } from "@/lib/booking/status";
import { getBookingById, getCourts } from "@/server/admin/bookings";

import { AdminPage, Notice } from "../../_components/admin-page";
import { AdminBookingForm } from "../_components/admin-booking-form";

export const metadata: Metadata = { title: "預約詳細資料" };

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function BookingDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();

  const [booking, courts] = await Promise.all([getBookingById(id), getCourts()]);
  if (!booking) notFound();

  return (
    <div className="space-y-4">
      {created && <Notice tone="success">已建立預約 {booking.booking_number}。</Notice>}

      <section className={cardClass}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="text-xl font-bold tracking-wider">{booking.booking_number}</p>
          <span className={`rounded-full px-3 py-1 text-sm ${BOOKING_STATUS_STYLES[booking.status]}`}>
            {BOOKING_STATUS_LABELS[booking.status]}
          </span>
          <Link
            href={`/admin/calendar?date=${booking.booking_date}`}
            className="ml-auto text-sm text-brand-700 underline"
          >
            查看當天場地表
          </Link>
        </div>
        <dl className="grid grid-cols-[5rem_1fr] gap-y-2 text-sm sm:grid-cols-[5rem_1fr_5rem_1fr]">
          <dt className="text-zinc-500">日期</dt>
          <dd>{formatDateWithWeekday(booking.booking_date)}</dd>
          <dt className="text-zinc-500">時間</dt>
          <dd>{formatTimeRange(booking.start_time, booking.end_time)}</dd>
          <dt className="text-zinc-500">場地</dt>
          <dd>{booking.court_name}</dd>
          <dt className="text-zinc-500">費用</dt>
          <dd className="font-bold">{booking.price.toLocaleString("zh-TW")}元</dd>
          <dt className="text-zinc-500">姓名</dt>
          <dd>{booking.customer_name}</dd>
          <dt className="text-zinc-500">電話</dt>
          <dd>{booking.customer_phone}</dd>
          <dt className="text-zinc-500">Email</dt>
          <dd className="break-all">{booking.customer_email ?? "—"}</dd>
          <dt className="text-zinc-500">來源</dt>
          <dd>{booking.source === "admin" ? "後台新增" : "線上預約"}</dd>
          <dt className="text-zinc-500">備註</dt>
          <dd className="whitespace-pre-wrap sm:col-span-3">{booking.note ?? "—"}</dd>
          <dt className="text-zinc-500">建立時間</dt>
          <dd>{formatTimestamp(booking.created_at)}</dd>
          {booking.cancelled_at && (
            <>
              <dt className="text-zinc-500">取消時間</dt>
              <dd>{formatTimestamp(booking.cancelled_at)}</dd>
            </>
          )}
        </dl>
      </section>

      <section className={cardClass}>
        <h2 className="mb-4 text-lg font-bold">修改預約</h2>
        <AdminBookingForm
          key={booking.updated_at}
          bookingId={booking.id}
          courts={courts}
          initialValues={{
            courtId: booking.court_id,
            date: booking.booking_date,
            startTime: formatTime(booking.start_time),
            endTime: formatTime(booking.end_time),
            name: booking.customer_name,
            phone: booking.customer_phone,
            email: booking.customer_email ?? "",
            price: String(booking.price),
            status: booking.status,
            note: booking.note ?? "",
          }}
        />
        <p className="mt-3 text-xs text-zinc-500">
          修改日期、時間或場地時會重新檢查撞場；費用不會自動改變，如需依新時段計價請按「依規則計算」。
        </p>
      </section>
    </div>
  );
}

export default function AdminBookingDetailPage(props: PageProps<"/admin/bookings/[id]">) {
  return (
    <AdminPage title="預約詳細資料">
      <BookingDetail
        params={props.params}
        searchParams={props.searchParams as Promise<{ created?: string }>}
      />
    </AdminPage>
  );
}
