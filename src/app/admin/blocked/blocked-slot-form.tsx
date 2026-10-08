"use client";

import { useState } from "react";

import { buttonBrand, inputClass, labelClass } from "@/components/ui/styles";
import { addOneHour, timeOptions } from "@/lib/booking/time-options";
import type { CourtRow } from "@/types/database";

import { MessageText, useMutation } from "../_components/use-mutation";
import { createBlockedSlotAction } from "../config-actions";

const HOURS = timeOptions();

export function BlockedSlotForm({ courts, today }: { courts: CourtRow[]; today: string }) {
  const [courtId, setCourtId] = useState("");
  const [date, setDate] = useState(today);
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const { isPending, message, run } = useMutation();

  return (
    <form
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            createBlockedSlotAction({
              courtId,
              date,
              allDay,
              startTime: allDay ? undefined : startTime,
              endTime: allDay ? undefined : endTime,
              reason,
            }),
          { successText: "已新增關閉時段", onSuccess: () => setReason("") },
        );
      }}
    >
      <div>
        <label htmlFor="blocked-court" className={labelClass}>場地</label>
        <select id="blocked-court" className={inputClass} value={courtId} onChange={(e) => setCourtId(e.target.value)}>
          <option value="">全館（所有場地）</option>
          {courts.map((court) => (
            <option key={court.id} value={court.id}>{court.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="blocked-date" className={labelClass}>日期</label>
        <input id="blocked-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="flex items-end">
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-5 w-5" />
          整天關閉
        </label>
      </div>
      <div>
        <label htmlFor="blocked-start" className={labelClass}>開始</label>
        <select
          id="blocked-start"
          className={inputClass}
          value={startTime}
          disabled={allDay}
          onChange={(e) => {
            setStartTime(e.target.value);
            if (endTime <= e.target.value) setEndTime(addOneHour(e.target.value));
          }}
        >
          {HOURS.slice(0, -1).map((hour) => <option key={hour}>{hour}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="blocked-end" className={labelClass}>結束</label>
        <select id="blocked-end" className={inputClass} value={endTime} disabled={allDay} onChange={(e) => setEndTime(e.target.value)}>
          {HOURS.slice(1).map((hour) => <option key={hour}>{hour}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="blocked-reason" className={labelClass}>原因</label>
        <input
          id="blocked-reason"
          className={inputClass}
          value={reason}
          maxLength={100}
          placeholder="例如：場地維修"
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-6">
        <button type="submit" className={buttonBrand} disabled={isPending}>
          {isPending ? "新增中…" : "新增關閉時段"}
        </button>
        <MessageText message={message} />
      </div>
    </form>
  );
}
