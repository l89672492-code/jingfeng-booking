import type { Metadata } from "next";

import { cardClass } from "@/components/ui/styles";
import { getAllSettings } from "@/server/admin/config";
import { requireAdmin } from "@/server/auth";

import { AdminPage } from "../_components/admin-page";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "系統設定" };

async function SettingsContent() {
  await requireAdmin();
  const settings = await getAllSettings();
  const values = Object.fromEntries(settings.map((row) => [row.key, row.value]));

  return (
    <section className={`${cardClass} max-w-xl`}>
      <SettingsForm initial={values} />
      <p className="mt-4 text-sm text-zinc-500">
        租借單位目前為 {values.slot_duration_minutes ?? "60"} 分鐘（第一版固定，不開放修改）。
      </p>
    </section>
  );
}

export default function AdminSettingsPage() {
  return (
    <AdminPage title="系統設定" description="取消期限、可預約天數與場館聯絡資訊。">
      <SettingsContent />
    </AdminPage>
  );
}
