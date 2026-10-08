"use client";

import { useState } from "react";

import { buttonBrand, inputClass, labelClass } from "@/components/ui/styles";

import { MessageText, useMutation } from "../_components/use-mutation";
import { createHolidayAction } from "../config-actions";

export function HolidayForm({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [isClosed, setIsClosed] = useState(true);
  const [dayType, setDayType] = useState<"" | "weekday" | "holiday">("holiday");
  const { isPending, message, run } = useMutation();

  return (
    <form
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => createHolidayAction({ date, name, isClosed, dayType: isClosed ? "" : dayType }), {
          successText: "已新增",
          onSuccess: () => setName(""),
        });
      }}
    >
      <div>
        <label htmlFor="holiday-date" className={labelClass}>日期</label>
        <input id="holiday-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <label htmlFor="holiday-name" className={labelClass}>名稱</label>
        <input
          id="holiday-name"
          className={inputClass}
          value={name}
          maxLength={50}
          placeholder="例如：國慶日"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="holiday-closed" className={labelClass}>是否休館</label>
        <select
          id="holiday-closed"
          className={inputClass}
          value={isClosed ? "closed" : "open"}
          onChange={(e) => setIsClosed(e.target.value === "closed")}
        >
          <option value="closed">休館（所有場地不可預約）</option>
          <option value="open">照常營業</option>
        </select>
      </div>
      <div>
        <label htmlFor="holiday-daytype" className={labelClass}>計價方式</label>
        <select
          id="holiday-daytype"
          className={inputClass}
          value={dayType}
          disabled={isClosed}
          onChange={(e) => setDayType(e.target.value as typeof dayType)}
        >
          <option value="holiday">以假日價格計算</option>
          <option value="weekday">以平日價格計算</option>
          <option value="">依星期判斷</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <button type="submit" className={buttonBrand} disabled={isPending}>
          {isPending ? "新增中…" : "新增特殊日期"}
        </button>
        <MessageText message={message} />
      </div>
    </form>
  );
}
