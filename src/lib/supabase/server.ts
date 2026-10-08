import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

import { getSupabasePublicEnv } from "./env";

/**
 * 伺服器端 Supabase client（供 Server Component、Server Function、Route Handler 使用）。
 * 使用 publishable key 並帶入使用者 cookie，權限與瀏覽器端相同，受 RLS 控管。
 */
export async function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 在 Server Component 中無法寫入 cookie，可忽略。
        }
      },
    },
  });
}
