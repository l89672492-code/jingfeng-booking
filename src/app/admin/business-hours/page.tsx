import type { Metadata } from "next";

import { cardClass } from "@/components/ui/styles";
import { getBusinessHours } from "@/server/admin/config";
import { requireAdmin } from "@/server/auth";

import { AdminPage } from "../_components/admin-page";

import { BusinessHoursForm } from "./business-hours-form";

export const metadata: Metadata = { title: "營業時間" };

async function BusinessHoursContent() {
  await requireAdmin();
  const hours = await getBusinessHours();
  return (
    <section className={`${cardClass} max-w-2xl`}>
      <BusinessHoursForm initial={hours} />
      <p className="mt-4 text-sm text-zinc-500">
        球友端的可預約時段會依這裡的設定，以每小時為單位自動產生。修改後已存在的預約不受影響。
      </p>
    </section>
  );
}

export default function AdminBusinessHoursPage() {
  return (
    <AdminPage title="營業時間">
      <BusinessHoursContent />
    </AdminPage>
  );
}
