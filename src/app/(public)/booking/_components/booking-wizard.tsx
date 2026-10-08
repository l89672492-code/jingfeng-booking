"use client";

import { useEffect, useState, useTransition } from "react";

import {
  buttonPrimary,
  buttonSecondary,
  cardClass,
  errorTextClass,
  inputClass,
  labelClass,
} from "@/components/ui/styles";
import {
  courtsForSlot,
  DISPLAY_STATUS_LABELS,
  summarizeTimeSlots,
  toDisplayStatus,
  type DisplayStatus,
} from "@/lib/booking/availability";
import {
  addDays,
  formatDateWithWeekday,
  formatTimeRange,
  monthRange,
  shiftMonth,
} from "@/lib/booking/dates";
import { GENERIC_ERROR_MESSAGE } from "@/lib/booking/errors";
import { customerBookingSchema, fieldErrors } from "@/lib/booking/validation";
import type { DateStatus, DayAvailabilityRow } from "@/types/database";

import { submitBooking } from "../actions";

import { MonthCalendar } from "./month-calendar";

const STEPS = ["選擇日期", "選擇時間", "選擇場地", "確認費用", "填寫資料", "確認預約"] as const;
type Step = 1 | 2 | 3 | 4 | 5 | 6;

/** 這些錯誤代表選的時段／場地已不能預約，要回到選場地重新選 */
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

const STATUS_STYLES: Record<DisplayStatus, string> = {
  available: "border-brand-300 bg-white text-zinc-900 hover:border-brand-500 hover:bg-brand-50",
  booked: "border-zinc-200 bg-zinc-100 text-zinc-400",
  unavailable: "border-zinc-200 bg-zinc-100 text-zinc-400",
  closed: "border-zinc-200 bg-zinc-100 text-zinc-400",
};

const STATUS_BADGE: Record<DisplayStatus, string> = {
  available: "bg-green-100 text-green-800",
  booked: "bg-red-100 text-red-700",
  unavailable: "bg-zinc-200 text-zinc-600",
  closed: "bg-zinc-200 text-zinc-600",
};

type Props = {
  today: string;
  maxDaysAhead: number;
  cancellationDeadlineHours: number;
};

type CustomerForm = { name: string; phone: string; email: string; note: string };

function formatPrice(price: number | null) {
  return price === null ? "—" : `${price.toLocaleString("zh-TW")}元`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? GENERIC_ERROR_MESSAGE);
  return body as T;
}

export function BookingWizard({ today, maxDaysAhead, cancellationDeadlineHours }: Props) {
  const lastBookableDate = addDays(today, maxDaysAhead);
  const firstMonth = today.slice(0, 7);
  const lastMonth = lastBookableDate.slice(0, 7);

  const [step, setStep] = useState<Step>(1);
  const [month, setMonth] = useState(firstMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>({ name: "", phone: "", email: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [dayVersion, setDayVersion] = useState(0);
  const [isSubmitting, startSubmit] = useTransition();

  // ---- 月曆資料 ----
  const [monthData, setMonthData] = useState<{
    month: string;
    statuses: Map<string, { status: DateStatus; holidayName: string | null }> | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthRange(month);
    fetchJson<{ dates: { date: string; status: DateStatus; holiday_name: string | null }[] }>(
      `/api/availability/dates?from=${from}&to=${to}`,
    )
      .then((body) => {
        if (cancelled) return;
        const statuses = new Map(
          body.dates.map((row) => [row.date, { status: row.status, holidayName: row.holiday_name }]),
        );
        setMonthData({ month, statuses, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setMonthData({ month, statuses: null, error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const monthStatuses = monthData?.month === month ? monthData.statuses : null;
  const monthError = monthData?.month === month ? monthData.error : null;

  // ---- 單日場地資料 ----
  const dayKey = selectedDate ? `${selectedDate}#${dayVersion}` : null;
  const [dayData, setDayData] = useState<{
    key: string;
    rows: DayAvailabilityRow[] | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!selectedDate || !dayKey) return;
    let cancelled = false;
    fetchJson<{ slots: DayAvailabilityRow[] }>(`/api/availability/day?date=${selectedDate}`)
      .then((body) => {
        if (!cancelled) setDayData({ key: dayKey, rows: body.slots, error: null });
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
  const timeSlots = dayRows ? summarizeTimeSlots(dayRows) : [];
  const selectedSlot = timeSlots.find((slot) => slot.startTime === selectedStart) ?? null;
  const courts = dayRows && selectedStart ? courtsForSlot(dayRows, selectedStart) : [];
  const selectedCourt = courts.find((court) => court.courtId === selectedCourtId) ?? null;

  function goTo(next: Step) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function refreshDay() {
    setDayVersion((version) => version + 1);
  }

  // ---- 步驟操作 ----
  function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedStart(null);
    setSelectedCourtId(null);
    setNotice(null);
    goTo(2);
  }

  function selectTime(startTime: string) {
    setSelectedStart(startTime);
    setSelectedCourtId(null);
    setNotice(null);
    refreshDay();
    goTo(3);
  }

  function selectCourt(courtId: string) {
    setSelectedCourtId(courtId);
    setNotice(null);
    goTo(4);
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
        setSelectedCourtId(null);
        refreshDay();
        goTo(3);
        return;
      }
      if (Object.keys(result.fieldErrors).length > 0) {
        setErrors(result.fieldErrors);
        goTo(5);
        return;
      }
      setNotice(result.error);
    });
  }

  function updateField(field: keyof CustomerForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: "" }));
  }

  // ---- 畫面 ----
  const summary = (
    <dl className="grid grid-cols-[4.5rem_1fr] gap-y-2 text-base">
      <dt className="text-zinc-500">日期</dt>
      <dd className="font-medium">{selectedDate && formatDateWithWeekday(selectedDate)}</dd>
      <dt className="text-zinc-500">時間</dt>
      <dd className="font-medium">
        {selectedSlot && formatTimeRange(selectedSlot.startTime, selectedSlot.endTime)}
      </dd>
      <dt className="text-zinc-500">場地</dt>
      <dd className="font-medium">{selectedCourt?.courtName}</dd>
      <dt className="text-zinc-500">費用</dt>
      <dd className="text-xl font-bold text-accent-600">{formatPrice(selectedCourt?.price ?? null)}</dd>
    </dl>
  );

  return (
    <div>
      {/* 進度 */}
      <ol className="mb-5 grid grid-cols-6 gap-1" aria-label="預約步驟">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const state = number < step ? "done" : number === step ? "current" : "todo";
          return (
            <li key={label} className="flex flex-col items-center gap-1 text-center">
              <span
                className={`h-1.5 w-full rounded-full ${state === "todo" ? "bg-zinc-200" : "bg-brand-600"}`}
              />
              <span
                className={`text-[11px] leading-tight sm:text-xs ${state === "current" ? "font-bold text-brand-700" : "text-zinc-500"}`}
                aria-current={state === "current" ? "step" : undefined}
              >
                {label}
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

      {/* Step 1：日期 */}
      {step === 1 && (
        <section className={cardClass}>
          <h2 className="mb-4 text-lg font-bold">Step 1　選擇日期</h2>
          <MonthCalendar
            month={month}
            today={today}
            statuses={monthStatuses}
            loading={monthData?.month !== month}
            selectedDate={selectedDate}
            canGoPrev={month > firstMonth}
            canGoNext={month < lastMonth}
            onPrev={() => setMonth(shiftMonth(month, -1))}
            onNext={() => setMonth(shiftMonth(month, 1))}
            onSelect={selectDate}
          />
          {monthError && <p className={errorTextClass}>{monthError}</p>}
          <p className="mt-4 text-sm text-zinc-500">
            可預約今天起 {maxDaysAhead} 天內的場地。
          </p>
        </section>
      )}

      {/* Step 2：時間 */}
      {step === 2 && selectedDate && (
        <section className={cardClass}>
          <h2 className="text-lg font-bold">Step 2　選擇時間</h2>
          <p className="mb-4 mt-1 text-zinc-600">{formatDateWithWeekday(selectedDate)}</p>

          {dayError && <p className={errorTextClass}>{dayError}</p>}
          {!dayRows && !dayError && <p className="py-6 text-center text-zinc-500">載入中…</p>}
          {dayRows && timeSlots.length === 0 && (
            <p className="py-6 text-center text-zinc-500">這天沒有開放預約的時段。</p>
          )}
          {dayRows && dayRows.length > 0 && dayRows.every((row) => row.status === "closed") && (
            <p className="mb-3 rounded-xl bg-zinc-100 p-3 text-center text-zinc-600">這天休館。</p>
          )}

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {timeSlots.map((slot) => {
              const full = slot.availableCount === 0;
              return (
                <li key={slot.startTime}>
                  <button
                    type="button"
                    disabled={full}
                    onClick={() => selectTime(slot.startTime)}
                    className={`flex min-h-14 w-full items-center justify-between rounded-xl border px-4 text-left transition-colors ${
                      full
                        ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                        : "border-zinc-300 bg-white hover:border-brand-500 hover:bg-brand-50"
                    }`}
                  >
                    <span className="text-lg font-bold">
                      {formatTimeRange(slot.startTime, slot.endTime)}
                    </span>
                    <span className="text-right text-sm">
                      {full ? (
                        "不可預約"
                      ) : (
                        <>
                          <span className="block font-bold text-accent-600">
                            {formatPrice(slot.price)}
                          </span>
                          <span className="text-zinc-500">剩 {slot.availableCount} 面</span>
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5">
            <button type="button" className={buttonSecondary} onClick={() => goTo(1)}>
              ‹ 重新選擇日期
            </button>
          </div>
        </section>
      )}

      {/* Step 3：場地 */}
      {step === 3 && selectedDate && selectedStart && (
        <section className={cardClass}>
          <h2 className="text-lg font-bold">Step 3　選擇場地</h2>
          <p className="mb-4 mt-1 text-zinc-600">
            {formatDateWithWeekday(selectedDate)}
            {selectedSlot && `　${formatTimeRange(selectedSlot.startTime, selectedSlot.endTime)}`}
          </p>

          {dayError && <p className={errorTextClass}>{dayError}</p>}
          {!dayRows && !dayError && <p className="py-6 text-center text-zinc-500">載入中…</p>}

          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {courts.map((court) => {
              const display = toDisplayStatus(court.status);
              const selectable = display === "available";
              return (
                <li key={court.courtId}>
                  <button
                    type="button"
                    disabled={!selectable}
                    onClick={() => selectCourt(court.courtId)}
                    className={`flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 transition-colors ${STATUS_STYLES[display]}`}
                  >
                    <span className="text-xl font-bold">{court.courtName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[display]}`}>
                      {DISPLAY_STATUS_LABELS[display]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {dayRows && courts.length > 0 && courts.every((court) => court.status !== "available") && (
            <p className="mt-4 text-center text-zinc-600">這個時段已沒有可預約的場地，請選擇其他時間。</p>
          )}

          <div className="mt-5">
            <button type="button" className={buttonSecondary} onClick={() => goTo(2)}>
              ‹ 重新選擇時間
            </button>
          </div>
        </section>
      )}

      {/* Step 4：費用 */}
      {step === 4 && selectedCourt && (
        <section className={cardClass}>
          <h2 className="mb-4 text-lg font-bold">Step 4　確認費用</h2>
          {summary}
          <p className="mt-4 text-sm text-zinc-500">費用依場館公告價格計算，請於現場付款。</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button type="button" className={buttonSecondary} onClick={() => goTo(3)}>
              ‹ 重新選擇場地
            </button>
            <button type="button" className={buttonPrimary} onClick={() => goTo(5)}>
              下一步：填寫資料
            </button>
          </div>
        </section>
      )}

      {/* Step 5：資料 */}
      {step === 5 && selectedCourt && (
        <section className={cardClass}>
          <h2 className="mb-4 text-lg font-bold">Step 5　填寫預約資料</h2>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (validateForm()) goTo(6);
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
              <button type="button" className={buttonSecondary} onClick={() => goTo(4)}>
                ‹ 上一步
              </button>
              <button type="submit" className={buttonPrimary}>
                下一步：確認預約
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Step 6：確認 */}
      {step === 6 && selectedCourt && (
        <section className={cardClass}>
          <h2 className="mb-4 text-lg font-bold">Step 6　確認預約</h2>
          {summary}
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
          <p className="mt-4 rounded-xl bg-accent-50 p-3 text-sm text-accent-700">
            開始前 {cancellationDeadlineHours} 小時以前可在「查詢預約」自行取消。
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              className={buttonSecondary}
              onClick={() => goTo(5)}
              disabled={isSubmitting}
            >
              ‹ 修改資料
            </button>
            <button
              type="button"
              className={buttonPrimary}
              onClick={confirmBooking}
              disabled={isSubmitting}
            >
              {isSubmitting ? "預約中…" : "確認預約"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
