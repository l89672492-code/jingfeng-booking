"use client";

import { useState, useTransition } from "react";

import {
  buttonBrand,
  buttonDanger,
  buttonSecondary,
  cardClass,
  errorTextClass,
  inputClass,
  labelClass,
} from "@/components/ui/styles";
import { formatDateWithWeekday, formatTimeRange } from "@/lib/booking/dates";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES } from "@/lib/booking/status";
import { bookingLookupSchema, fieldErrors } from "@/lib/booking/validation";
import type { CustomerBookingRow } from "@/types/database";

import { cancelMyBooking, lookupBooking } from "../actions";

function formatDeadline(timestamp: string) {
  // cancel_deadline 為台灣當地時間（不含時區），直接取字串顯示
  const [date, time] = timestamp.replace("T", " ").split(" ");
  return `${formatDateWithWeekday(date)} ${time.slice(0, 5)}`;
}

export function MyBookingLookup() {
  const [bookingNumber, setBookingNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [booking, setBooking] = useState<CustomerBookingRow | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setConfirmingCancel(false);

    const parsed = bookingLookupSchema.safeParse({ bookingNumber, phone });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await lookupBooking(parsed.data);
      if (result.ok) {
        setBooking(result.booking);
      } else {
        setBooking(null);
        setError(result.error);
        setErrors(result.fieldErrors);
      }
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelMyBooking({ bookingNumber, phone });
      setConfirmingCancel(false);
      if (result.ok) {
        setBooking(result.booking);
        setMessage(result.message ?? null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleLookup} noValidate className={`${cardClass} space-y-4`}>
        <div>
          <label htmlFor="bookingNumber" className={labelClass}>
            預約編號
          </label>
          <input
            id="bookingNumber"
            className={`${inputClass} uppercase`}
            value={bookingNumber}
            onChange={(event) => setBookingNumber(event.target.value)}
            placeholder="JF202610150001"
            autoComplete="off"
            maxLength={20}
            aria-invalid={Boolean(errors.bookingNumber)}
          />
          {errors.bookingNumber && <p className={errorTextClass}>{errors.bookingNumber}</p>}
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>
            手機號碼
          </label>
          <input
            id="phone"
            className={inputClass}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0912345678"
            maxLength={20}
            aria-invalid={Boolean(errors.phone)}
          />
          {errors.phone && <p className={errorTextClass}>{errors.phone}</p>}
        </div>
        <button type="submit" className={`${buttonBrand} w-full`} disabled={isPending}>
          {isPending && !booking ? "查詢中…" : "查詢"}
        </button>
      </form>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-green-800">
          {message}
        </div>
      )}

      {booking && (
        <section className={cardClass}>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-bold tracking-wider">{booking.booking_number}</p>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${BOOKING_STATUS_STYLES[booking.status]}`}
            >
              {BOOKING_STATUS_LABELS[booking.status]}
            </span>
          </div>
          <dl className="grid grid-cols-[4.5rem_1fr] gap-y-2 text-base">
            <dt className="text-zinc-500">日期</dt>
            <dd className="font-medium">{formatDateWithWeekday(booking.booking_date)}</dd>
            <dt className="text-zinc-500">時間</dt>
            <dd className="font-medium">{formatTimeRange(booking.start_time, booking.end_time)}</dd>
            <dt className="text-zinc-500">場地</dt>
            <dd className="font-medium">{booking.court_name}</dd>
            <dt className="text-zinc-500">費用</dt>
            <dd className="font-bold text-accent-600">{booking.price.toLocaleString("zh-TW")}元</dd>
            <dt className="text-zinc-500">狀態</dt>
            <dd className="font-medium">{BOOKING_STATUS_LABELS[booking.status]}</dd>
          </dl>

          {booking.can_cancel ? (
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <p className="mb-3 text-sm text-zinc-500">
                可自行取消至 {formatDeadline(booking.cancel_deadline)}。
              </p>
              {confirmingCancel ? (
                <div className="space-y-3 rounded-xl bg-red-50 p-3">
                  <p className="font-medium text-red-800">確定要取消這筆預約嗎？取消後無法復原。</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className={buttonSecondary}
                      onClick={() => setConfirmingCancel(false)}
                      disabled={isPending}
                    >
                      不要取消
                    </button>
                    <button
                      type="button"
                      className={buttonDanger}
                      onClick={handleCancel}
                      disabled={isPending}
                    >
                      {isPending ? "取消中…" : "確定取消預約"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={`${buttonDanger} w-full sm:w-auto`}
                  onClick={() => setConfirmingCancel(true)}
                >
                  取消預約
                </button>
              )}
            </div>
          ) : (
            (booking.status === "confirmed" || booking.status === "pending") && (
              <p className="mt-5 border-t border-zinc-200 pt-4 text-sm text-zinc-500">
                已超過可自行取消的時間，如需取消請聯絡勁丰羽球館。
              </p>
            )
          )}
        </section>
      )}
    </div>
  );
}
