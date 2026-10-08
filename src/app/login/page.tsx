import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { buttonSecondary, cardClass } from "@/components/ui/styles";
import { getCurrentUser } from "@/server/auth";

import { signOut } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "管理員登入",
  robots: { index: false, follow: false },
};

async function LoginContent({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const [{ denied }, current] = await Promise.all([searchParams, getCurrentUser()]);

  // 已登入但不是後台人員
  if (current && !current.staff) {
    return (
      <div className="space-y-4">
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">
          此帳號沒有後台權限，請聯絡管理員。
        </p>
        <form action={signOut}>
          <button type="submit" className={`${buttonSecondary} w-full`}>
            登出並改用其他帳號
          </button>
        </form>
      </div>
    );
  }

  if (current?.staff) {
    return (
      <div className="space-y-4">
        <p className="text-zinc-700">已登入：{current.staff.email}</p>
        <Link href="/admin" className={`${buttonSecondary} w-full`}>
          進入管理後台
        </Link>
      </div>
    );
  }

  return (
    <>
      {denied && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-800">
          此帳號沒有後台權限。
        </p>
      )}
      <LoginForm />
    </>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-brand-50 px-4 py-10">
      <div className={`${cardClass} w-full max-w-sm`}>
        <h1 className="mb-1 text-xl font-bold text-brand-800">勁丰羽球館</h1>
        <p className="mb-6 text-zinc-600">管理後台登入</p>
        <Suspense fallback={<p className="py-6 text-center text-zinc-500">載入中…</p>}>
          <LoginContent searchParams={props.searchParams as Promise<{ denied?: string }>} />
        </Suspense>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-zinc-500 underline">
            回到首頁
          </Link>
        </p>
      </div>
    </main>
  );
}
