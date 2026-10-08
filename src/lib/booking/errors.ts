/**
 * 資料庫函式拋出的錯誤代碼 → 給使用者看的中文訊息。
 * 不顯示任何技術錯誤內容。
 */

export const GENERIC_ERROR_MESSAGE =
  "目前系統暫時無法完成預約，請稍後再試或直接聯絡勁丰羽球館。";

const ERROR_MESSAGES = {
  BOOKING_CONFLICT: "這個場地剛剛已被其他球友預約，請重新選擇。",
  COURT_NOT_FOUND: "找不到這個場地，請重新選擇。",
  COURT_UNAVAILABLE: "這個場地目前暫停開放，請選擇其他場地。",
  DATE_IN_PAST: "這個時段已經過了，請選擇其他時段。",
  DATE_TOO_FAR: "超過可預約的日期範圍，請選擇較近的日期。",
  FACILITY_CLOSED: "這天休館，請選擇其他日期。",
  OUTSIDE_BUSINESS_HOURS: "這個時段不在營業時間內，請重新選擇。",
  INVALID_TIME: "預約時段不正確，請重新選擇。",
  SLOT_BLOCKED: "這個時段暫停開放預約，請選擇其他時段。",
  PRICE_NOT_FOUND: "這個時段目前無法預約，請選擇其他時段或聯絡勁丰羽球館。",
  INVALID_INPUT: "資料不完整，請重新填寫。",
  INVALID_NAME: "請輸入姓名（最多 50 字）。",
  INVALID_PHONE: "請輸入正確的電話號碼。",
  INVALID_EMAIL: "Email 格式不正確。",
  INVALID_NOTE: "備註最多 500 字。",
  INVALID_PRICE: "費用不正確。",
  INVALID_STATUS: "預約狀態不正確。",
  BOOKING_NOT_FOUND: "查無此預約，請確認預約編號與手機號碼。",
  ALREADY_CANCELLED: "這筆預約已經取消。",
  CANCEL_NOT_ALLOWED: "這筆預約無法取消。",
  CANCEL_DEADLINE_PASSED: "已超過可自行取消的時間，如需取消請聯絡勁丰羽球館。",
  FORBIDDEN: "沒有權限執行此操作。",
} as const;

export type BookingErrorCode = keyof typeof ERROR_MESSAGES;

export function isBookingErrorCode(value: unknown): value is BookingErrorCode {
  return typeof value === "string" && value in ERROR_MESSAGES;
}

/** 取得資料庫錯誤代碼（不認得的錯誤回傳 null） */
export function getErrorCode(error: unknown): BookingErrorCode | null {
  const message =
    error && typeof error === "object" && "message" in error
      ? (error as { message: unknown }).message
      : error;
  return isBookingErrorCode(message) ? message : null;
}

export function getErrorMessage(error: unknown): string {
  const code = getErrorCode(error);
  return code ? ERROR_MESSAGES[code] : GENERIC_ERROR_MESSAGE;
}
