import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { signOut } from "@/app/login/actions";
import { requireStaff } from "@/server/auth";

import { AdminNav, AdminNavView } from "./_components/admin-nav";

export const metadata: Metadata = {
  title: { default: "管理後台", template: "%s｜勁丰羽球館後台" },
  robots: { index: false, follow: false },
};

const ROLE_LABELS = { admin: "管理員", staff: "員工" } as const;

async function UserBar() {
  const staff = await requireStaff();
  return (
    <div className="flex items-center justify-end gap-3 text-sm text-zinc-600">
      <span className="truncate">
        {staff.name || staff.email}
        <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
          {ROLE_LABELS[staff.role]}
        </span>
      </span>
      <Link href="/" className="text-zinc-500 underline">
        前台
      </Link>
      <form action={signOut}>
        <button type="submit" className="rounded-lg border border-zinc-300 px-3 py-1 hover:bg-zinc-50">
          登出
        </button>
      </form>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 lg:flex-row">
      <Suspense fallback={<AdminNavView pathname={null} />}>
        <AdminNav />
      </Suspense>
      <div className="min-w-0 flex-1">
        <div className="border-b border-zinc-200 bg-white px-4 py-2 lg:px-8">
          <Suspense fallback={<div className="h-7" />}>
            <UserBar />
          </Suspense>
        </div>
        <div className="px-4 py-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
