import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { taipeiToday } from "@/lib/booking/dates";
import { getPublicSettingsSafe } from "@/server/settings";

import { BookingWizard } from "./_components/booking-wizard";

export const metadata: Metadata = {
  title: "租場預約",
  description: "線上查看勁丰羽球館場地空檔，選擇日期、時間與場地完成租場預約。",
};

async function BookingLoader() {
  // 「今天」必須以請求當下的台灣時間計算，不能在 build 時決定
  await connection();
  const facility = await getPublicSettingsSafe();

  return (
    <BookingWizard
      today={taipeiToday()}
      maxDaysAhead={facility?.bookingMaxDaysAhead ?? 30}
      cancellationDeadlineHours={facility?.cancellationDeadlineHours ?? 2}
    />
  );
}

export default function BookingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-brand-800">租場預約</h1>
      <Suspense fallback={<p className="py-10 text-center text-zinc-500">載入中…</p>}>
        <BookingLoader />
      </Suspense>
    </main>
  );
}
