/** 共用 Tailwind class，讓按鈕與表單外觀一致 */

export const buttonPrimary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 text-base font-bold text-white transition-colors hover:bg-accent-600 active:bg-accent-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500";

export const buttonBrand =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-base font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500";

export const buttonSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

export const buttonDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 text-base font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

export const buttonSmall =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";

export const inputClass =
  "block w-full min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 aria-[invalid=true]:border-red-500";

export const labelClass = "mb-1 block text-sm font-medium text-zinc-700";

export const cardClass = "rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6";

export const errorTextClass = "mt-1 text-sm text-red-600";
