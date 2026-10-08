"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  buttonPrimary,
  buttonSecondary,
  cardClass,
  errorTextClass,
  inputClass,
  labelClass,
} from "@/components/ui/styles";
import { courtsForSlot, summarizeTimeSlots } from "@/lib/booking/availability";
import { addDays, formatDateWithWeekday, formatTimeRange, weekdayName } from "@/lib/booking/dates";
import { GENERIC_ERROR_MESSAGE } from "@/lib/booking/errors";
import { customerBookingSchema, fieldErrors } from "@/lib/booking/validation";
import type { DateStatus, DayAvailabilityRow } from "@/types/database";

import { submitBooking } from "../actions";

import { CourtSlotGrid } from "./court-slot-grid";
import { DateStrip, type DateOption } from "./date-strip";

const STEPS = ["選擇場地時段", "填寫資料", "確認預約"] as const;
type Step = 1 | 2 | 3;

/** 這些錯誤代表選的時段／場地已不能預約，要回到第一步重新選 */
const RESELECT_CODES = new Set([
  "BOOKING_CONFLICT",
  "COURT_NOT_FOUND",
  "COURT_UNAVAILABLE",
  "SLOT_BLOCKED",
  "DATE_IN_PAST",
  "DATE_TOO_FAR",
  "FACILITY_CLOSED",
  "OUTSIDE_BUSINESS_HOURS",
  "INVALID_TIME",
  "PRICE_NOT_FOUND",
]);

type Props = {
  today: string;
  maxDaysAhead: number;
  cancellationDeadlineHours: number;
};

type CustomerForm = { name: string; phone: string; email: string; note: string };

function formatPrice(price: number | null) {
  return price === null ? "—" : `${price.toLocaleString("zh-TW")}元`;
}

/** 10/12（一） */
function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8))}（${weekdayName(date).slice(2)}）`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? GENERIC_ERROR_MESSAGE);
  return body as T;
}

export function BookingWizard({ today, maxDaysAhead, cancellationDeadlineHours }: Props) {
  const lastBookableDate = addDays(today, maxDaysAhead);

  const [step, setStep] = useState<Step>(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ courtId: string; startTime: string } | null>(null);
  const [form, setForm] = useState<CustomerForm>({ name: "", phone: "", email: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [dayVersion, setDayVersion] = useState(0);
  const [isSubmitting, startSubmit] = useTransition();

  // ---- 可預約日期（今天起 maxDaysAhead 天）----
  const [dates, setDates] = useState<{ list: DateOption[] | null; error: string | null }>({
    list: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ dates: { date: string; status: DateStatus; holiday_name: string | null }[] }>(
      `/api/availability/dates?from=${today}&to=${lastBookableDate}`,
    )
      .then((body) => {
        if (cancelled) return;
        const list = body.dates.map((row) => ({
          date: row.date,
          status: row.status,
          holidayName: row.holiday_name,
        }));
        setDates({ list, error: null });
        // 預設選第一個可預約的日期，讓場地表直接顯示
        const firstOpen = list.find((row) => row.status === "open");
        if (firstOpen) setSelectedDate((current) => current ?? firstOpen.date);
      })
      .catch((error: Error) => {
        if (!cancelled) setDates({ list: null, error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [today, lastBookableDate]);

  // ---- 選定日期的場地 × 時段 ----
  const dayKey = selectedDate ? `${selectedDate}#${dayVersion}` : null;
  const [dayData, setDayData] = useState<{
    key: string;
    rows: DayAvailabilityRow[] | null;
    error: string | null;
  } | null>(null);

  // 自動選的日期若已沒有任何可預約時段（例如今天已接近打烊），自動跳到下一個可預約日
  const autoPickRef = useRef(true);
  const dateListRef = useRef<DateOption[] | null>(null);
  useEffect(() => {
    dateListRef.current = dates.list;
  }, [dates.list]);

  useEffect(() => {
    if (!selectedDate || !dayKey) return;
    let cancelled = false;
    fetchJson<{ slots: DayAvailabilityRow[] }>(`/api/availability/day?date=${selectedDate}`)
      .then((body) => {
        if (cancelled) return;
        if (autoPickRef.current && !body.slots.some((row) => row.status === "available")) {
          const next = dateListRef.current?.find(
            (row) => row.status === "open" && row.date > selectedDate,
          );
          if (next) {
            setSelectedDate(next.date);
            return;
          }
        }
        autoPickRef.current = false;
        setDayData({ key: dayKey, rows: body.slots, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setDayData({ key: dayKey, rows: null, error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, dayKey]);

  const dayRows = dayData?.key === dayKey ? dayData.rows : null;
  const dayError = dayData?.key === dayKey ? dayData.error : null;

  // 選擇的格子必須仍是「可預約」才算有效（重新整理後可能已被別人訂走）
  const selectedSlot =
    dayRows && selected
      ? (summarizeTimeSlots(dayRows).find((slot) => slot.startTime === selected.startTime) ?? null)
      : null;
  const selectedCourt =
    dayRows && selected
      ? (courtsForSlot(dayRows, selected.startTime).find(
          (court) => court.courtId === selected.courtId && court.status === "available",
        ) ?? null)
      : null;
  const hasSelection = Boolean(selectedDate && selectedSlot && selectedCourt);

  function goTo(next: Step) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectDate(date: string) {
    autoPickRef.current = false;
    if (date === selectedDate) return;
    setSelectedDate(date);
    setSelected(null);
    setNotice(null);
  }

  function selectCell(courtId: string, startTime: string) {
    setSelected({ courtId, startTime });
    setNotice(null);
  }

  function buildInput() {
    return {
      courtId: selectedCourt?.courtId ?? "",
      date: selectedDate ?? "",
      startTime: selectedSlot?.startTime ?? "",
      endTime: selectedSlot?.endTime ?? "",
      ...form,
    };
  }

  function validateForm() {
    const parsed = customerBookingSchema.safeParse(buildInput());
    if (parsed.success) {
      setErrors({});
      return true;
    }
    setErrors(fieldErrors(parsed.error));
    return false;
  }

  function confirmBooking() {
    setNotice(null);
    startSubmit(async () => {
      const result = await submitBooking(buildInput());
      // 成功時 server 會直接導向成功頁，只有失敗才會回到這裡
      if (result.code && RESELECT_CODES.has(result.code)) {
        setNotice(result.error);
        setSelected(null);
        setDayVersion((version) => version + 1);
        goTo(1);
        return;
      }
      if (Object.keys(result.fieldErrors).length > 0) {
        setErrors(result.fieldErrors);
        goTo(2);
        return;
      }
      setNotice(result.error);
    });
  }

  function updateField(field: keyof CustomerForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: "" }));
  }

  const selectionSummary =
    hasSelection && selectedDate && selectedSlot && selectedCourt
      ? `${shortDate(selectedDate)} ${formatTimeRange(selectedSlot.startTime, selectedSlot.endTime)} ${selectedCourt.courtName}`
      : null;

  return (
    <div className={step === 1 ? "pb-24" : undefined}>
      {/* 進度 */}
      <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="預約步驟">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const state = number < step ? "done" : number === step ? "current" : "todo";
          return (
            <li key={label} className="flex flex-col gap-1 text-center">
              <span className={`h-1.5 w-full rounded-full ${state === "todo" ? "bg-zinc-200" : "bg-brand-600"}`} />
              <span
                className={`text-xs ${state === "current" ? "font-bold text-brand-700" : "text-zinc-500"}`}
                aria-current={state === "current" ? "step" : undefined}
              >
                {number}. {label}
              </span>
            </li>
          );
        })}
      </ol>

      {notice && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
          {notice}
        </div>
      )}

      {/* Step 1：日期 + 時間 + 場地 */}
      {step === 1 && (
        <>
          <section className={cardClass}>
            <h2 className="mb-3 text-lg font-bold">選擇日期</h2>
            <DateStrip dates={dates.list} today={today} selectedDate={selectedDate} onSelect={selectDate} />
            {dates.error && <p className={errorTextClass}>{dates.error}</p>}
            {dates.list && !dates.list.some((row) => row.status === "open") && (
              <p className="mt-3 text-zinc-500">目前沒有可預約的日期。</p>
            )}
          </section>

          {selectedDate && (
            <section className={`${cardClass} mt-4`}>
              <h2 className="text-lg font-bold">選擇時間與場地</h2>
              <p className="mb-3 mt-1 text-sm text-zinc-600">
                {formatDateWithWeekday(selectedDate)}・點一格選擇
              </p>
              {dayError && <p className={errorTextClass}>{dayError}</p>}
              {!dayRows && !dayError && <p className="py-8 text-center text-zinc-500">載入中…</p>}
              {dayRows && <CourtSlotGrid rows={dayRows} selected={selected} onSelect={selectCell} />}
            </section>
          )}

          {/* 底部固定列：目前選擇 + 下一步 */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
              <p className="min-w-0 flex-1 text-sm">
                {selectionSummary ? (
                  <>
                    <span className="block text-xs text-zinc-500">已選擇</span>
                    <span className="block truncate font-bold text-zinc-900">{selectionSummary}</span>
                  </>
                ) : (
                  <span className="text-zinc-500">請選擇日期、時間與場地</span>
                )}
              </p>
              <button
                type="button"
                className={`${buttonPrimary} shrink-0`}
                disabled={!hasSelection}
                onClick={() => goTo(2)}
              >
                下一步
              </button>
            </div>
          </div>
        </>
      )}

      {/* Step 2：資料 */}
      {step === 2 && hasSelection && (
        <section className={cardClass}>
          <h2 className="text-lg font-bold">填寫預約資料</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-600">{selectionSummary}</p>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (validateForm()) goTo(3);
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="name" className={labelClass}>
                姓名 <span className="text-red-600">*</span>
              </label>
              <input
                id="name"
                className={inputClass}
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                autoComplete="name"
                maxLength={50}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className={errorTextClass}>{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>
                手機 <span className="text-red-600">*</span>
              </label>
              <input
                id="phone"
                className={inputClass}
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0912345678"
                maxLength={20}
                aria-invalid={Boolean(errors.phone)}
              />
              {errors.phone && <p className={errorTextClass}>{errors.phone}</p>}
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>
                Email <span className="text-zinc-400">（非必填）</span>
              </label>
              <input
                id="email"
                className={inputClass}
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={254}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <p className={errorTextClass}>{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="note" className={labelClass}>
                備註 <span className="text-zinc-400">（非必填）</span>
              </label>
              <textarea
                id="note"
                className={`${inputClass} min-h-20 py-2`}
                value={form.note}
                onChange={(event) => updateField("note", event.target.value)}
                rows={3}
                maxLength={500}
                aria-invalid={Boolean(errors.note)}
              />
              {errors.note && <p className={errorTextClass}>{errors.note}</p>}
            </div>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
              <button type="button" className={buttonSecondary} onClick={() => goTo(1)}>
                ‹ 重新選擇場地時段
              </button>
              <button type="submit" className={buttonPrimary}>
                下一步：確認費用
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Step 3：確認費用與預約 */}
      {step === 3 && hasSelection && selectedDate && selectedSlot && selectedCourt && (
        <section className={cardClass}>
          <h2 className="mb-4 text-lg font-bold">確認預約</h2>

          <div className="mb-4 rounded-2xl bg-accent-50 p-4 text-center">
            <p className="text-sm text-accent-700">場地費用</p>
            <p className="text-3xl font-bold text-accent-600">{formatPrice(selectedCourt.price)}</p>
            <p className="mt-1 text-xs text-accent-700">請於現場付款</p>
          </div>

          <dl className="grid grid-cols-[4.5rem_1fr] gap-y-2 text-base">
            <dt className="text-zinc-500">日期</dt>
            <dd className="font-medium">{formatDateWithWeekday(selectedDate)}</dd>
            <dt className="text-zinc-500">時間</dt>
            <dd className="font-medium">{formatTimeRange(selectedSlot.startTime, selectedSlot.endTime)}</dd>
            <dt className="text-zinc-500">場地</dt>
            <dd className="font-medium">{selectedCourt.courtName}</dd>
          </dl>
          <hr className="my-4 border-zinc-200" />
          <dl className="grid grid-cols-[4.5rem_1fr] gap-y-2 text-base">
            <dt className="text-zinc-500">姓名</dt>
            <dd className="font-medium break-all">{form.name}</dd>
            <dt className="text-zinc-500">手機</dt>
            <dd className="font-medium">{form.phone}</dd>
            {form.email && (
              <>
                <dt className="text-zinc-500">Email</dt>
                <dd className="font-medium break-all">{form.email}</dd>
              </>
            )}
            {form.note && (
              <>
                <dt className="text-zinc-500">備註</dt>
                <dd className="whitespace-pre-wrap break-all">{form.note}</dd>
              </>
            )}
          </dl>
          <p className="mt-4 text-sm text-zinc-500">
            開始前 {cancellationDeadlineHours} 小時以前可在「查詢預約」自行取消。
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button type="button" className={buttonSecondary} onClick={() => goTo(2)} disabled={isSubmitting}>
              ‹ 修改資料
            </button>
            <button type="button" className={buttonPrimary} onClick={confirmBooking} disabled={isSubmitting}>
              {isSubmitting ? "預約中…" : "確認預約"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
