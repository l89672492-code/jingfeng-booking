"use client";

import { useState } from "react";

import { buttonBrand, buttonSmall } from "@/components/ui/styles";
import { formatTime } from "@/lib/booking/dates";
import { PRICING_DAY_TYPE_LABELS } from "@/lib/booking/status";
import { addOneHour, timeOptions } from "@/lib/booking/time-options";
import type { PricingDayType, PricingRuleRow } from "@/types/database";

import { MessageText, useMutation } from "../_components/use-mutation";
import { savePricingRuleAction, togglePricingRuleAction } from "../config-actions";

const HOURS = timeOptions();
const cell = "rounded-lg border border-zinc-300 bg-white px-2 py-1.5";

type Props = { rule: PricingRuleRow | null };

/** 新增（rule = null）或修改一條價格規則 */
export function PricingRuleForm({ rule }: Props) {
  const [dayType, setDayType] = useState<PricingDayType>(rule?.day_type ?? "weekday");
  const [specialDate, setSpecialDate] = useState(rule?.special_date ?? "");
  const [startTime, setStartTime] = useState(rule ? formatTime(rule.start_time) : "09:00");
  const [endTime, setEndTime] = useState(rule ? formatTime(rule.end_time) : "18:00");
  const [price, setPrice] = useState(rule ? String(rule.price) : "");
  const { isPending, message, run } = useMutation();

  const active = rule?.active ?? true;

  function save(event: React.FormEvent) {
    event.preventDefault();
    run(
      () =>
        savePricingRuleAction(rule?.id ?? null, {
          dayType,
          specialDate,
          startTime,
          endTime,
          price,
          active,
        }),
      {
        successText: rule ? "已儲存" : "已新增價格規則",
        onSuccess: () => {
          if (!rule) setPrice("");
        },
      },
    );
  }

  return (
    <form
      onSubmit={save}
      className={`flex flex-wrap items-center gap-2 py-3 ${rule ? "border-b border-zinc-100" : ""} ${
        rule && !rule.active ? "opacity-60" : ""
      }`}
    >
      <select
        className={cell}
        value={dayType}
        aria-label="日期類型"
        onChange={(e) => setDayType(e.target.value as PricingDayType)}
      >
        {Object.entries(PRICING_DAY_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      {dayType === "special" && (
        <input
          type="date"
          className={cell}
          value={specialDate}
          aria-label="特殊日期"
          onChange={(e) => setSpecialDate(e.target.value)}
        />
      )}
      <select
        className={cell}
        value={startTime}
        aria-label="開始時間"
        onChange={(e) => {
          setStartTime(e.target.value);
          if (endTime <= e.target.value) setEndTime(addOneHour(e.target.value));
        }}
      >
        {HOURS.slice(0, -1).map((hour) => <option key={hour}>{hour}</option>)}
      </select>
      <span className="text-zinc-400">–</span>
      <select className={cell} value={endTime} aria-label="結束時間" onChange={(e) => setEndTime(e.target.value)}>
        {HOURS.slice(1).map((hour) => <option key={hour}>{hour}</option>)}
      </select>
      <label className="flex items-center gap-1">
        <input
          className={`${cell} w-24 text-right`}
          inputMode="numeric"
          value={price}
          placeholder="價格"
          aria-label="每小時價格"
          onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
        />
        <span className="text-sm text-zinc-500">元／小時</span>
      </label>

      {rule ? (
        <>
          <button type="submit" className={buttonSmall} disabled={isPending}>
            儲存
          </button>
          <button
            type="button"
            className={buttonSmall}
            disabled={isPending}
            onClick={() =>
              run(() => togglePricingRuleAction(rule.id, !rule.active), {
                successText: rule.active ? "已停用" : "已啟用",
              })
            }
          >
            {rule.active ? "停用" : "啟用"}
          </button>
          {!rule.active && <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">已停用</span>}
        </>
      ) : (
        <button type="submit" className={buttonBrand} disabled={isPending}>
          {isPending ? "新增中…" : "新增"}
        </button>
      )}
      <MessageText message={message} />
    </form>
  );
}
