import type { Metadata } from "next";

import { cardClass } from "@/components/ui/styles";
import { formatDateWithWeekday } from "@/lib/booking/dates";
import { PRICING_DAY_TYPE_LABELS as DAY_TYPE_LABELS } from "@/lib/booking/status";
import { getPricingRules } from "@/server/admin/config";
import { requireAdmin } from "@/server/auth";
import type { PricingDayType, PricingRuleRow } from "@/types/database";

import { AdminPage } from "../_components/admin-page";

import { PricingRuleForm } from "./pricing-rule-form";

export const metadata: Metadata = { title: "價格管理" };

const GROUPS: PricingDayType[] = ["weekday", "holiday", "special"];

async function PricingContent() {
  await requireAdmin();
  const rules = await getPricingRules();
  const byType = (type: PricingDayType) => rules.filter((rule) => rule.day_type === type);

  const specialDates = [...new Set(byType("special").map((rule) => rule.special_date))];

  function renderRows(rows: PricingRuleRow[]) {
    // key 包含 updated_at：儲存後重新整理時表單會以最新資料重建
    return rows.map((rule) => <PricingRuleForm key={`${rule.id}-${rule.updated_at}`} rule={rule} />);
  }

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h2 className="mb-2 text-lg font-bold">新增價格規則</h2>
        <PricingRuleForm rule={null} />
        <p className="mt-2 text-sm text-zinc-500">
          價格優先順序：特殊日期 &gt; 假日 &gt; 平日。星期六、日為假日；國定假日可在「休館日」設定為假日價格。
          每個可預約時段都必須被一條啟用中的規則完整涵蓋，否則該時段會顯示不可預約。
        </p>
      </section>

      {GROUPS.map((type) => (
        <section key={type} className={`${cardClass} overflow-x-auto`}>
          <h2 className="text-lg font-bold">{DAY_TYPE_LABELS[type]}</h2>
          {byType(type).length === 0 ? (
            <p className="py-3 text-zinc-500">尚未設定。</p>
          ) : type === "special" ? (
            specialDates.map((date) => (
              <div key={date} className="mt-3">
                <p className="text-sm font-medium text-zinc-600">{date && formatDateWithWeekday(date)}</p>
                {renderRows(byType("special").filter((rule) => rule.special_date === date))}
              </div>
            ))
          ) : (
            renderRows(byType(type))
          )}
        </section>
      ))}
    </div>
  );
}

export default function AdminPricingPage() {
  return (
    <AdminPage title="價格管理" description="球友端與預約建立時一律以這裡的價格計算，修改後立即生效（不影響已建立的預約）。">
      <PricingContent />
    </AdminPage>
  );
}
