import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-brand-800 bg-brand-700 text-white">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-wide">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-500 text-sm"
          >
            勁
          </span>
          勁丰羽球館
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/my-booking"
            className="rounded-lg px-3 py-2 text-brand-100 hover:bg-brand-600 hover:text-white"
          >
            查詢預約
          </Link>
          <Link
            href="/booking"
            className="rounded-lg bg-accent-500 px-3 py-2 font-bold hover:bg-accent-600"
          >
            立即預約
          </Link>
        </nav>
      </div>
    </header>
  );
}
