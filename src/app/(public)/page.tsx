import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { buttonPrimary, buttonSecondary } from "@/components/ui/styles";
import { lineHref, phoneHref } from "@/lib/facility";
import { getPublicSettingsSafe } from "@/server/settings";

const AMENITIES = [
  "5面標準PU羽球場",
  "免費停車",
  "飲水機",
  "簡易盥洗",
  "羽球販賣",
  "球拍穿線服務",
];

async function FacilityContact() {
  await connection();
  const facility = await getPublicSettingsSafe();
  if (!facility) {
    return <p className="text-sm text-brand-100">場館資訊暫時無法載入。</p>;
  }

  return (
    <dl className="space-y-2 text-base">
      <div className="flex gap-2">
        <dt className="shrink-0 text-brand-200">地址</dt>
        <dd>{facility.address}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="shrink-0 text-brand-200">電話</dt>
        <dd>
          <a href={phoneHref(facility.phone)} className="font-medium underline underline-offset-2">
            {facility.phone}
          </a>
        </dd>
      </div>
      <div className="flex gap-2">
        <dt className="shrink-0 text-brand-200">LINE</dt>
        <dd>
          <a
            href={lineHref(facility.line)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
          >
            {facility.line}
          </a>
        </dd>
      </div>
    </dl>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <section className="rounded-3xl bg-brand-700 px-5 py-8 text-white sm:px-8 sm:py-10">
        <h1 className="text-3xl font-bold tracking-wide sm:text-4xl">勁丰羽球館</h1>
        <p className="mt-2 text-lg text-accent-200">羽球場地租借</p>

        <div className="mt-6">
          <Suspense fallback={<div className="h-24" />}>
            <FacilityContact />
          </Suspense>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/booking" className={`${buttonPrimary} w-full text-lg sm:w-auto sm:px-10`}>
            立即預約
          </Link>
          <Link
            href="/my-booking"
            className={`${buttonSecondary} w-full border-transparent sm:w-auto`}
          >
            查詢我的預約
          </Link>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold text-zinc-800">場館設施</h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AMENITIES.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700"
            >
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent-500" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
