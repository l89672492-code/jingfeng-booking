import type { Metadata } from "next";

import { cardClass } from "@/components/ui/styles";
import { addDays, formatDateWithWeekday, taipeiToday } from "@/lib/booking/dates";
import { getHolidays } from "@/server/admin/config";
import { requireAdmin } from "@/server/auth";

import { AdminPage } from "../_components/admin-page";
import { ConfirmDeleteButton } from "../_components/confirm-delete-button";
import { deleteHolidayAction } from "../config-actions";

import { HolidayForm } from "./holiday-form";

export const metadata: Metadata = { title: "休館日" };

const DAY_TYPE_LABELS = { weekday: "平日價格", holiday: "假日價格" } as const;

async function HolidayContent() {
  await requireAdmin();
  const today = taipeiToday();
  const holidays = await getHolidays(addDays(today, -30));

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h2 className="mb-4 text-lg font-bold">新增特殊日期</h2>
        <HolidayForm today={today} />
        <p className="mt-3 text-sm text-zinc-500">
          設為休館後，當天所有場地不可預約；已存在的預約不會被自動取消。
          若要針對特殊日期設定不同價格，請到「價格管理」新增特殊日期價格。
        </p>
      </section>

      <section className={`${cardClass} overflow-x-auto`}>
        <h2 className="mb-3 text-lg font-bold">已設定的日期</h2>
        {holidays.length === 0 ? (
          <p className="text-zinc-500">目前沒有設定。</p>
        ) : (
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-medium">日期</th>
                <th className="py-2 pr-3 font-medium">名稱</th>
                <th className="py-2 pr-3 font-medium">設定</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {holidays.map((holiday) => (
                <tr key={holiday.id} className={`border-b border-zinc-100 ${holiday.holiday_date < today ? "text-zinc-400" : ""}`}>
                  <td className="py-2 pr-3">{formatDateWithWeekday(holiday.holiday_date)}</td>
                  <td className="py-2 pr-3">{holiday.name}</td>
                  <td className="py-2 pr-3">
                    {holiday.is_closed ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">休館</span>
                    ) : holiday.day_type ? (
                      `營業・${DAY_TYPE_LABELS[holiday.day_type]}`
                    ) : (
                      "營業・依星期計價"
                    )}
                  </td>
                  <td className="py-2">
                    <ConfirmDeleteButton action={deleteHolidayAction.bind(null, holiday.id)} />
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

export default function AdminHolidaysPage() {
  return (
    <AdminPage title="休館日" description="設定國定假日、休館日，或指定某天以假日／平日價格計算。">
      <HolidayContent />
    </AdminPage>
  );
}
