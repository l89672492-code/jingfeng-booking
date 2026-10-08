import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";

import { buttonPrimary, buttonSecondary, cardClass } from "@/components/ui/styles";
import { formatDateWithWeekday, formatTimeRange } from "@/lib/booking/dates";
import { lineHref, phoneHref } from "@/lib/facility";
import { getBookingByNumber } from "@/server/bookings";
import { getPublicSettingsSafe } from "@/server/settings";

import { parseSuccessCookie, SUCCESS_COOKIE } from "../success-cookie";

export const metadata: Metadata = {
  title: "預約成功",
  robots: { index: false },
};

async function SuccessContent() {
  const cookieStore = await cookies();
  const saved = parseSuccessCookie(cookieStore.get(SUCCESS_COOKIE)?.value);

  if (!saved) {
    return (
      <div className={cardClass}>
        <p className="text-zinc-700">找不到剛才的預約資訊。</p>
        <p className="mt-2 text-sm text-zinc-500">
          如果已完成預約，可以用預約編號與手機號碼查詢。
        </p>
        <Link href="/my-booking" className={`${buttonSecondary} mt-4`}>
          查詢我的預約
        </Link>
      </div>
    );
  }

  const [result, facility] = await Promise.all([
    getBookingByNumber(saved),
    getPublicSettingsSafe(),
  ]);
  const booking = result.ok ? result.data : null;

  if (!booking) {
    return (
      <div className={cardClass}>
        <p className="text-zinc-700">{result.ok ? "查無此預約。" : result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-green-50 p-5 text-center">
        <p className="text-2xl font-bold text-green-800">預約成功</p>
        <p className="mt-2 text-sm text-green-700">預約編號</p>
        <p className="text-2xl font-bold tracking-wider text-zinc-900">{booking.booking_number}</p>
      </div>

      <div className={cardClass}>
        <dl className="grid grid-cols-[4.5rem_1fr] gap-y-2 text-base">
          <dt className="text-zinc-500">日期</dt>
          <dd className="font-medium">{formatDateWithWeekday(booking.booking_date)}</dd>
          <dt className="text-zinc-500">時間</dt>
          <dd className="font-medium">{formatTimeRange(booking.start_time, booking.end_time)}</dd>
          <dt className="text-zinc-500">場地</dt>
          <dd className="font-medium">{booking.court_name}</dd>
          <dt className="text-zinc-500">費用</dt>
          <dd className="text-xl font-bold text-accent-600">
            {booking.price.toLocaleString("zh-TW")}元
          </dd>
          <dt className="text-zinc-500">姓名</dt>
          <dd className="font-medium break-all">{booking.customer_name}</dd>
          <dt className="text-zinc-500">手機</dt>
          <dd className="font-medium">{booking.customer_phone}</dd>
        </dl>
      </div>

      <div className="rounded-2xl border border-accent-200 bg-accent-50 p-4 text-accent-700">
        <p className="font-bold">提醒</p>
        <p className="mt-1">
          請保留預約編號，如需修改或取消預約，請聯絡勁丰羽球館。
        </p>
        {facility && (
          <p className="mt-2 text-sm">
            電話：
            <a href={phoneHref(facility.phone)} className="underline">
              {facility.phone}
            </a>
            　LINE：
            <a href={lineHref(facility.line)} className="underline" target="_blank" rel="noopener noreferrer">
              {facility.line}
            </a>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/my-booking" className={buttonSecondary}>
          查詢我的預約
        </Link>
        <Link href="/booking" className={buttonPrimary}>
          再預約一個場地
        </Link>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <Suspense fallback={<p className="py-10 text-center text-zinc-500">載入中…</p>}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
