import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { getSupabasePublicEnv } from "./env";

/**
 * 管理端 Supabase client（使用 secret key，會略過 RLS）。
 *
 * - 只能在伺服器端使用（Server Function、Route Handler）。
 * - 由 `server-only` 保護：若被 Client Component 匯入，build 會直接失敗。
 * - 不可將回傳結果未經篩選直接送到瀏覽器。
 */
export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  // 支援新版 secret key（sb_secret_...）與舊版 service_role key
  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey) {
    throw new Error(
      "缺少 Supabase 環境變數：請在 .env.local 設定 SUPABASE_SECRET_KEY（可參考 .env.example）。",
    );
  }

  return createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
