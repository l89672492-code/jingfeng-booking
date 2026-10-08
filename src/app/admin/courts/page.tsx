import type { Metadata } from "next";

import { cardClass } from "@/components/ui/styles";
import { getCourts } from "@/server/admin/bookings";
import { requireAdmin } from "@/server/auth";

import { AdminPage } from "../_components/admin-page";

import { CourtRowForm } from "./court-row-form";

export const metadata: Metadata = { title: "場地管理" };

async function CourtList() {
  await requireAdmin();
  const courts = await getCourts();
  return (
    <section className={cardClass}>
      {courts.map((court) => (
        <CourtRowForm key={court.id} court={court} />
      ))}
      <p className="mt-3 text-sm text-zinc-500">
        停用的場地球友端會顯示「不可預約」；已存在的預約不受影響，請另行聯絡球友。
      </p>
    </section>
  );
}

export default function AdminCourtsPage() {
  return (
    <AdminPage title="場地管理" description="啟用／停用場地、修改名稱與顯示順序。">
      <CourtList />
    </AdminPage>
  );
}
