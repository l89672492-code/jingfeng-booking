import { Suspense } from "react";

/** 後台頁面外框：標題屬於靜態外框，內容（需要登入與資料庫）在 Suspense 內串流 */
export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
        </div>
        {actions}
      </div>
      <Suspense fallback={<p className="py-10 text-center text-zinc-500">載入中…</p>}>
        {children}
      </Suspense>
    </div>
  );
}

export function Notice({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-4 rounded-xl border p-3 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-800"
      }`}
    >
      {children}
    </div>
  );
}
