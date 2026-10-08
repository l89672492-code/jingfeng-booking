import type { Metadata } from "next";

import { cardClass } from "@/components/ui/styles";
import { formatDateWithWeekday, formatTimeRange, taipeiToday } from "@/lib/booking/dates";
import { getCourts } from "@/server/admin/bookings";
import { getBlockedSlots } from "@/server/admin/config";
import { requireStaff } from "@/server/auth";

import { AdminPage } from "../_components/admin-page";
import { ConfirmDeleteButton } from "../_components/confirm-delete-button";
import { deleteBlockedSlotAction } from "../config-actions";

import { BlockedSlotForm } from "./blocked-slot-form";

export const metadata: Metadata = { title: "關閉時段" };

async function BlockedContent() {
  await requireStaff();
  const today = taipeiToday();
  const [courts, blocked] = await Promise.all([getCourts(), getBlockedSlots(today)]);
  const courtNames = new Map(courts.map((court) => [court.id, court.name]));

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h2 className="mb-4 text-lg font-bold">新增關閉時段</h2>
        <BlockedSlotForm courts={courts} today={today} />
        <p className="mt-3 text-sm text-zinc-500">
          關閉的時段球友端會顯示「不可預約」。已存在的預約不會被自動取消。
        </p>
      </section>

      <section className={`${cardClass} overflow-x-auto`}>
        <h2 className="mb-3 text-lg font-bold">今天起的關閉時段</h2>
        {blocked.length === 0 ? (
          <p className="text-zinc-500">目前沒有設定。</p>
        ) : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-medium">日期</th>
                <th className="py-2 pr-3 font-medium">場地</th>
                <th className="py-2 pr-3 font-medium">時間</th>
                <th className="py-2 pr-3 font-medium">原因</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {blocked.map((slot) => (
                <tr key={slot.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-3">{formatDateWithWeekday(slot.blocked_date)}</td>
                  <td className="py-2 pr-3">{slot.court_id ? courtNames.get(slot.court_id) : "全館"}</td>
                  <td className="py-2 pr-3">
                    {slot.start_time && slot.end_time ? formatTimeRange(slot.start_time, slot.end_time) : "整天"}
                  </td>
                  <td className="py-2 pr-3">{slot.reason || "—"}</td>
                  <td className="py-2">
                    <ConfirmDeleteButton action={deleteBlockedSlotAction.bind(null, slot.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default function AdminBlockedPage() {
  return (
    <AdminPage title="關閉時段" description="整館或指定場地、整天或指定時間暫停開放預約。">
      <BlockedContent />
    </AdminPage>
  );
}
