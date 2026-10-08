"use client";

import { useState } from "react";

import { buttonSmall } from "@/components/ui/styles";
import type { CourtRow } from "@/types/database";

import { MessageText, useMutation } from "../_components/use-mutation";
import { saveCourtAction } from "../config-actions";

const cell = "rounded-lg border border-zinc-300 bg-white px-2 py-1.5";

export function CourtRowForm({ court }: { court: CourtRow }) {
  const [name, setName] = useState(court.name);
  const [sortOrder, setSortOrder] = useState(String(court.sort_order));
  const [status, setStatus] = useState(court.status);
  const { isPending, message, run } = useMutation();

  return (
    <form
      className="flex flex-wrap items-center gap-3 border-b border-zinc-100 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveCourtAction(court.id, { name, sortOrder, status }), { successText: "已儲存" });
      }}
    >
      <label className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">名稱</span>
        <input className={`${cell} w-28`} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">排序</span>
        <input
          className={`${cell} w-20`}
          inputMode="numeric"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value.replace(/[^\d]/g, ""))}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">狀態</span>
        <select className={cell} value={status} onChange={(e) => setStatus(e.target.value as CourtRow["status"])}>
          <option value="active">啟用</option>
          <option value="inactive">停用（暫停預約）</option>
        </select>
      </label>
      <button type="submit" className={buttonSmall} disabled={isPending}>
        {isPending ? "儲存中…" : "儲存"}
      </button>
      <MessageText message={message} />
    </form>
  );
}
