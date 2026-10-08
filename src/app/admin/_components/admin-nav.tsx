"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "後台首頁" },
  { href: "/admin/calendar", label: "場地表" },
  { href: "/admin/bookings", label: "預約列表" },
  { href: "/admin/bookings/new", label: "新增預約" },
  { href: "/admin/pricing", label: "價格管理" },
  { href: "/admin/courts", label: "場地管理" },
  { href: "/admin/blocked", label: "關閉時段" },
  { href: "/admin/holidays", label: "休館日" },
  { href: "/admin/business-hours", label: "營業時間" },
  { href: "/admin/settings", label: "系統設定" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/bookings") {
    return pathname === "/admin/bookings" || /^\/admin\/bookings\/(?!new)[^/]+$/.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  return <AdminNavView pathname={usePathname()} />;
}

/** pathname 為 null 時（尚未取得網址）不標示目前頁面，作為 Suspense fallback */
export function AdminNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="後台選單"
      className="border-b border-brand-800 bg-brand-800 text-white lg:w-52 lg:shrink-0 lg:border-b-0 lg:border-r"
    >
      <div className="px-4 py-3 lg:py-5">
        <Link href="/admin" className="font-bold">
          勁丰羽球館
          <span className="ml-1 text-sm font-normal text-brand-200">後台</span>
        </Link>
      </div>
      <ul className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:pb-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname !== null && isActive(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-accent-500 font-bold text-white" : "text-brand-100 hover:bg-brand-700"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
