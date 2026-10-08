"use client";

import { useState } from "react";

import { buttonBrand, inputClass, labelClass } from "@/components/ui/styles";

import { MessageText, useMutation } from "../_components/use-mutation";
import { saveSettingsAction } from "../config-actions";

const FIELDS = [
  { key: "cancellation_deadline_hours", label: "球友可自行取消的期限（開始前幾小時）", numeric: true },
  { key: "booking_max_days_ahead", label: "最多可預約幾天後的場地", numeric: true },
  { key: "facility_name", label: "場館名稱", numeric: false },
  { key: "facility_phone", label: "電話", numeric: false },
  { key: "facility_address", label: "地址", numeric: false },
  { key: "facility_line", label: "官方 LINE ID", numeric: false },
] as const;

type Key = (typeof FIELDS)[number]["key"];

export function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const [values, setValues] = useState<Record<Key, string>>(
    () => Object.fromEntries(FIELDS.map((field) => [field.key, initial[field.key] ?? ""])) as Record<Key, string>,
  );
  const { isPending, message, run } = useMutation();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveSettingsAction(values), { successText: "已儲存設定" });
      }}
    >
      {FIELDS.map((field) => (
        <div key={field.key}>
          <label htmlFor={field.key} className={labelClass}>{field.label}</label>
          <input
            id={field.key}
            className={inputClass}
            inputMode={field.numeric ? "numeric" : undefined}
            value={values[field.key]}
            onChange={(e) =>
              setValues((previous) => ({
                ...previous,
                [field.key]: field.numeric ? e.target.value.replace(/[^\d]/g, "") : e.target.value,
              }))
            }
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonBrand} disabled={isPending}>
          {isPending ? "儲存中…" : "儲存設定"}
        </button>
        <MessageText message={message} />
      </div>
    </form>
  );
}
