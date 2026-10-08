import type { Metadata } from "next";

import { cardClass } from "@/components/ui/styles";
import { isValidIsoDate, taipeiToday } from "@/lib/booking/dates";
import { addOneHour } from "@/lib/booking/time-options";
import { getCourts } from "@/server/admin/bookings";

import { AdminPage } from "../../_components/admin-page";
import { AdminBookingForm } from "../_components/admin-booking-form";

export const metadata: Metadata = { title: "新增預約" };

type Search = { date?: string; start?: string; court?: string };

async function NewBookingForm({ searchParams }: { searchParams: Promise<Search> }) {
  const [params, courts] = await Promise.all([searchParams, getCourts()]);

  // 從場地表點「可租」進來時會帶入日期、時間、場地
  const date = params.date && isValidIsoDate(params.date) ? params.date : taipeiToday();
  const startTime = params.start && /^\d{2}:00$/.test(params.start) ? params.start : "19:00";
  const courtId = courts.some((court) => court.id === params.court) ? (params.court as string) : "";

  return (
    <section className={cardClass}>
      <AdminBookingForm
        bookingId={null}
        courts={courts}
        initialValues={{
          courtId,
          date,
          startTime,
          endTime: addOneHour(startTime),
          name: "",
          phone: "",
          email: "",
          price: "",
          status: "confirmed",
          note: "",
        }}
      />
    </section>
  );
}

export default function NewAdminBookingPage(props: PageProps<"/admin/bookings/new">) {
  return (
    <AdminPage
      title="新增預約"
      description="管理員新增的預約同樣會檢查撞場、營業時間、休館與關閉時段。費用留白則依價格規則計算。"
    >
      <NewBookingForm searchParams={props.searchParams as Promise<Search>} />
    </AdminPage>
  );
}
