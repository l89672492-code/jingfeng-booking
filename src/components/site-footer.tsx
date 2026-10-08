import { connection } from "next/server";
import { Suspense } from "react";

import { lineHref, phoneHref } from "@/lib/facility";
import { getPublicSettingsSafe } from "@/server/settings";

async function FooterContact() {
  await connection();
  const facility = await getPublicSettingsSafe();
  if (!facility) return null;

  return (
    <div className="space-y-1">
      <p className="font-bold text-zinc-800">{facility.name}</p>
      <p>{facility.address}</p>
      <p>
        電話：
        <a href={phoneHref(facility.phone)} className="text-brand-700 underline">
          {facility.phone}
        </a>
        <span className="mx-2 text-zinc-300">|</span>
        LINE：
        <a
          href={lineHref(facility.line)}
          className="text-brand-700 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {facility.line}
        </a>
      </p>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-600">
        <Suspense fallback={<div className="h-14" />}>
          <FooterContact />
        </Suspense>
      </div>
    </footer>
  );
}
