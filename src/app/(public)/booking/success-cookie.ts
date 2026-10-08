/** 預約成功頁使用的 cookie（存放剛建立的預約編號與手機，30 分鐘後失效） */
export const SUCCESS_COOKIE = "jf_last_booking";

export function parseSuccessCookie(
  value: string | undefined,
): { bookingNumber: string; phone: string } | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      "n" in parsed &&
      "p" in parsed &&
      typeof parsed.n === "string" &&
      typeof parsed.p === "string"
    ) {
      return { bookingNumber: parsed.n, phone: parsed.p };
    }
  } catch {
    // cookie 內容不正確時視為沒有
  }
  return null;
}
