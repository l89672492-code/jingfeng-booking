import type { Metadata } from "next";

import { MyBookingLookup } from "./_components/my-booking-lookup";

export const metadata: Metadata = {
  title: "查詢我的預約",
  description: "輸入預約編號與手機號碼，查詢或取消勁丰羽球館的場地預約。",
};

export default function MyBookingPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="text-2xl font-bold text-brand-800">查詢我的預約</h1>
      <p className="mb-4 mt-1 text-zinc-600">請輸入預約編號與預約時填寫的手機號碼。</p>
      <MyBookingLookup />
    </main>
  );
}
