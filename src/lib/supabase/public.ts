import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { getSupabasePublicEnv } from "./env";

/**
 * 伺服器端「訪客」client：使用 publishable key、不帶任何 cookie。
 * 用於讀取公開資料（可預約狀態、場地、公開設定），權限等同未登入訪客。
 */
export function createPublicClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createClient<Database>(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
