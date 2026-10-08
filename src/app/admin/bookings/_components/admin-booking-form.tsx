"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  buttonBrand,
  buttonDanger,
  buttonSecondary,
  buttonSmall,
  errorTextClass,
  inputClass,
  labelClass,
} from "@/components/ui/styles";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/status";
import { addOneHour, timeOptions } from "@/lib/booking/time-options";
import { BOOKING_STATUSES } from "@/lib/booking/validation";
import type { BookingStatus, CourtRow } from "@/types/database";

import { cancelBookingAction, previewPriceAction, saveBookingAction } from "../actions";

export type AdminBookingFormValues = {
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  name: string;
  phone: string;
  email: string;
  price: string;
  status: BookingStatus;
  note: string;
};

type Props = {
  bookingId: string | null;
  courts: CourtRow[];
  initialValues: AdminBookingFormValues;
};

const HOURS = timeOptions();

export function AdminBookingForm({ bookingId, courts, initialValues }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [priceHint, setPriceHint] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof AdminBookingFormValues>(key: K, value: AdminBookingFormValues[K]) {
    setValues((previous) => {
      const next = { ...previous, [key]: value };
      // 改開始時間時，若結束時間不再晚於開始時間，自動設為一小時後
      if (key === "startTime" && next.endTime <= next.startTime) {
        next.endTime = addOneHour(next.startTime);
      }
      return next;
    });
    setErrors((previous) => ({ ...previous, [key]: "" }));
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveBookingAction(bookingId, values);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        setMessage({ tone: "error", text: result.error });
        return;
      }
      if (bookingId) {
        setMessage({ tone: "success", text: "已儲存。" });
        router.refresh();
      } else {
        router.push(`/admin/bookings/${result.id}?created=1`);
      }
    });
  }

  function previewPrice() {
    setPriceHint(null);
    startTransition(async () => {
      const result = await previewPriceAction(values.date, values.startTime, values.endTime);
      if (result.price === null) {
        setPriceHint(result.error ?? "無法計算");
      } else {
        update("price", String(result.price));
        setPriceHint(`依價格規則：${result.price.toLocaleString("zh-TW")}元`);
      }
    });
  }

  function cancelBooking() {
    if (!bookingId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await cancelBookingAction(bookingId);
      setConfirmingCancel(false);
      if (result.ok) {
        setValues((previous) => ({ ...previous, status: "cancelled" }));
        setMessage({ tone: "success", text: "已取消預約，場地已釋出。" });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result.error ?? "取消失敗" });
      }
    });
  }

  const field = (key: keyof AdminBookingFormValues) => ({
    id: key,
    "aria-invalid": Boolean(errors[key]),
  });

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm ${
            message.tone === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {message.text}
        </p>
      )}

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 font-bold text-zinc-800">時段</legend>
        <div>
          <label htmlFor="date" className={labelClass}>日期</label>
          <input
            {...field("date")}
            type="date"
            className={inputClass}
            value={values.date}
            onChange={(event) => update("date", event.target.value)}
          />
          {errors.date && <p className={errorTextClass}>{errors.date}</p>}
        </div>
        <div>
          <label htmlFor="startTime" className={labelClass}>開始</label>
          <select
            {...field("startTime")}
            className={inputClass}
            value={values.startTime}
            onChange={(event) => update("startTime", event.target.value)}
          >
            {HOURS.slice(0, -1).map((hour) => (
              <option key={hour} value={hour}>{hour}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="endTime" className={labelClass}>結束</label>
          <select
            {...field("endTime")}
            className={inputClass}
            value={values.endTime}
            onChange={(event) => update("endTime", event.target.value)}
          >
            {HOURS.slice(1).map((hour) => (
              <option key={hour} value={hour}>{hour}</option>
            ))}
          </select>
          {errors.endTime && <p className={errorTextClass}>{errors.endTime}</p>}
        </div>
        <div>
          <label htmlFor="courtId" className={labelClass}>場地</label>
          <select
            {...field("courtId")}
            className={inputClass}
            value={values.courtId}
            onChange={(event) => update("courtId", event.target.value)}
          >
            <option value="">請選擇</option>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name}
                {court.status !== "active" ? "（停用）" : ""}
              </option>
            ))}
          </select>
          {errors.courtId && <p className={errorTextClass}>{errors.courtId}</p>}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-bold text-zinc-800">顧客資料</legend>
        <div>
          <label htmlFor="name" className={labelClass}>姓名</label>
          <input
            {...field("name")}
            className={inputClass}
            value={values.name}
            maxLength={50}
            onChange={(event) => update("name", event.target.value)}
          />
          {errors.name && <p className={errorTextClass}>{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>電話</label>
          <input
            {...field("phone")}
            type="tel"
            className={inputClass}
            value={values.phone}
            maxLength={20}
            onChange={(event) => update("phone", event.target.value)}
          />
          {errors.phone && <p className={errorTextClass}>{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>Email（非必填）</label>
          <input
            {...field("email")}
            type="email"
            className={inputClass}
            value={values.email}
            maxLength={254}
            onChange={(event) => update("email", event.target.value)}
          />
          {errors.email && <p className={errorTextClass}>{errors.email}</p>}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-bold text-zinc-800">費用與狀態</legend>
        <div>
          <label htmlFor="price" className={labelClass}>費用（元）</label>
          <div className="flex gap-2">
            <input
              {...field("price")}
              inputMode="numeric"
              className={inputClass}
              value={values.price}
              placeholder="空白＝依價格規則"
              onChange={(event) => update("price", event.target.value.replace(/[^\d]/g, ""))}
            />
            <button type="button" className={`${buttonSmall} shrink-0`} onClick={previewPrice} disabled={isPending}>
              依規則計算
            </button>
          </div>
          {errors.price && <p className={errorTextClass}>{errors.price}</p>}
          {priceHint && <p className="mt-1 text-sm text-zinc-500">{priceHint}</p>}
        </div>
        <div>
          <label htmlFor="status" className={labelClass}>狀態</label>
          <select
            {...field("status")}
            className={inputClass}
            value={values.status}
            onChange={(event) => update("status", event.target.value as BookingStatus)}
          >
            {BOOKING_STATUSES.filter((status) => bookingId || status !== "cancelled").map((status) => (
              <option key={status} value={status}>{BOOKING_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="note" className={labelClass}>備註</label>
          <textarea
            {...field("note")}
            className={`${inputClass} min-h-20 py-2`}
            value={values.note}
            maxLength={500}
            onChange={(event) => update("note", event.target.value)}
          />
          {errors.note && <p className={errorTextClass}>{errors.note}</p>}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4">
        <button type="submit" className={buttonBrand} disabled={isPending}>
          {isPending ? "處理中…" : bookingId ? "儲存修改" : "建立預約"}
        </button>
        <button type="button" className={buttonSecondary} onClick={() => router.back()}>
          返回
        </button>

        {bookingId && values.status !== "cancelled" && (
          <div className="ml-auto flex items-center gap-2">
            {confirmingCancel ? (
              <>
                <span className="text-sm text-red-700">確定取消這筆預約？</span>
                <button type="button" className={buttonSecondary} onClick={() => setConfirmingCancel(false)}>
                  不要
                </button>
                <button type="button" className={buttonDanger} onClick={cancelBooking} disabled={isPending}>
                  確定取消
                </button>
              </>
            ) : (
              <button type="button" className={buttonDanger} onClick={() => setConfirmingCancel(true)}>
                取消預約
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
