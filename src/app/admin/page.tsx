import Link from "next/link";

import { cardClass } from "@/components/ui/styles";
import { formatDateWithWeekday, formatTimeRange, taipeiTimeNow, taipeiToday } from "@/lib/booking/dates";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_STYLES } from "@/lib/booking/status";
import {
  completeFinishedBookings,
  getCourts,
  getDashboardStats,
} from "@/server/admin/bookings";
import { requireStaff } from "@/server/auth";

import { AdminPage, Notice } from "./_components/admin-page";

function money(value: number) {
  return `${value.toLocaleString("zh-TW")}元`;
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await requireStaff();
  await completeFinishedBookings();

  const today = taipeiToday();
  const now = taipeiTimeNow();
  const [{ denied }, stats, courts] = await Promise.all([
    searchParams,
    getDashboardStats(today),
    getCourts(),
  ]);

  const cards = [
    { label: "今日預約", value: `${stats.todayCount}筆` },
    { label: "今日租場收入", value: money(stats.todayRevenue) },
    { label: "本週預約", value: `${stats.weekCount}筆` },
    { label: "本月預約", value: `${stats.monthCount}筆` },
    { label: "本月租場收入", value: money(stats.monthRevenue) },
  ];

  return (
    <div className="space-y-6">
      {denied && <Notice tone="error">此功能僅限管理員使用。</Notice>}

      <p className="text-zinc-600">{formatDateWithWeekday(today)}</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className={cardClass}>
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-brand-800">{card.value}</p>
          </div>
        ))}
      </div>

      <section className={cardClass}>
        <h2 className="mb-3 text-lg font-bold">目前場地使用狀況</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {courts.map((court) => {
            const courtBookings = stats.todayBookings.filter((b) => b.court_id === court.id);
            const current = courtBookings.find((b) => b.start_time <= now && b.end_time > now);
            const next = courtBookings.find((b) => b.start_time > now);
            return (
              <div
                key={court.id}
                className={`rounded-xl border p-3 ${
                  court.status !== "active"
                    ? "border-zinc-200 bg-zinc-100"
                    : current
                      ? "border-brand-300 bg-brand-50"
                      : "border-green-200 bg-green-50"
                }`}
              >
                <p className="font-bold">{court.name}</p>
                <p className="mt-1 text-sm">
                  {court.status !== "active" ? (
                    <span className="text-zinc-500">停用中</span>
                  ) : current ? (
                    <Link href={`/admin/bookings/${current.id}`} className="text-brand-800 underline">
                      使用中：{current.customer_name}（{formatTimeRange(current.start_time, current.end_time)}）
                    </Link>
                  ) : (
                    <span className="text-green-800">目前空場</span>
                  )}
                </p>
                {next && (
                  <p className="mt-1 text-xs text-zinc-500">
                    下一場 {formatTimeRange(next.start_time, next.end_time)} {next.customer_name}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">今日預約</h2>
          <Link href={`/admin/calendar?date=${today}`} className="text-sm text-brand-700 underline">
            查看場地表
          </Link>
        </div>
        {stats.todayBookings.length === 0 ? (
          <p className="text-zinc-500">今天還沒有預約。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-zinc-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">時間</th>
                  <th className="py-2 pr-3 font-medium">場地</th>
                  <th className="py-2 pr-3 font-medium">姓名</th>
                  <th className="py-2 pr-3 font-medium">電話</th>
                  <th className="py-2 pr-3 font-medium">費用</th>
                  <th className="py-2 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {stats.todayBookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3">
                      <Link href={`/admin/bookings/${booking.id}`} className="text-brand-700 underline">
                        {formatTimeRange(booking.start_time, booking.end_time)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{booking.court_name}</td>
                    <td className="py-2 pr-3">{booking.customer_name}</td>
                    <td className="py-2 pr-3">{booking.customer_phone}</td>
                    <td className="py-2 pr-3">{money(booking.price)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${BOOKING_STATUS_STYLES[booking.status]}`}>
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminHomePage(props: PageProps<"/admin">) {
  return (
    <AdminPage title="後台首頁">
      <Dashboard searchParams={props.searchParams as Promise<{ denied?: string }>} />
    </AdminPage>
  );
}
