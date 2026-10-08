/**
 * Supabase 公開設定（瀏覽器與伺服器皆可使用）。
 * 於實際建立 client 時才檢查，避免未設定環境變數時影響 build。
 *
 * 金鑰名稱同時支援 Supabase 新版與舊版：
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY（sb_publishable_...，建議）
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY（舊版 anon JWT）
 *
 * 注意：NEXT_PUBLIC_* 必須以 process.env.NEXT_PUBLIC_XXX 直接存取，
 * Next.js 才會在建置時將其內嵌到瀏覽器程式碼中。
 */
export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "缺少 Supabase 環境變數：請在 .env.local 設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY（可參考 .env.example）。",
    );
  }

  return { url, publishableKey };
}
