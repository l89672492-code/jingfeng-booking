/**
 * 讀取 Supabase 連線設定。
 * 於實際建立 client 時才檢查，避免未設定環境變數時影響 build。
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "缺少 Supabase 環境變數：請在 .env.local 設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY（可參考 .env.example）。",
    );
  }

  return { url, anonKey };
}
