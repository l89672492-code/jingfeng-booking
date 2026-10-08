import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

import { getSupabasePublicEnv } from "./env";

/**
 * 瀏覽器端 Supabase client（供 Client Component 使用）。
 * 僅使用 publishable key，資料存取權限由 Supabase RLS 控管。
 */
export function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
