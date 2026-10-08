import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/types/database";

export type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
};

/**
 * 目前登入的後台人員（每個請求只查一次）。
 * - 未登入 → null
 * - 已登入但不在 profiles（不是 admin / staff）→ { user, staff: null }
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("id", claims.sub)
    .maybeSingle();

  const staff: StaffUser | null = profile
    ? {
        id: profile.id,
        email: typeof claims.email === "string" ? claims.email : "",
        name: profile.name,
        role: profile.role,
      }
    : null;

  return { userId: claims.sub, staff };
});

/** 後台頁面與 Server Action 必須先呼叫：未登入或不是後台人員就導向登入頁 */
export async function requireStaff(): Promise<StaffUser> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (!current.staff) redirect("/login?denied=1");
  return current.staff;
}

/** 僅限管理員（價格、場地、營業時間、休館日、系統設定） */
export async function requireAdmin(): Promise<StaffUser> {
  const staff = await requireStaff();
  if (staff.role !== "admin") redirect("/admin?denied=1");
  return staff;
}
