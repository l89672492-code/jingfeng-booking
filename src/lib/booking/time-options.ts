/**
 * 後台下拉選單用的時間選項（00:00–24:00，預設每 30 分鐘一個）。
 * 實際可預約的時段仍由資料庫依營業時間與 slot_step_minutes 判斷，這裡只是輸入選項。
 */
export function timeOptions(stepMinutes = 30): string[] {
  const options: string[] = [];
  for (let minutes = 0; minutes <= 24 * 60; minutes += stepMinutes) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    options.push(`${hour}:${minute}`);
  }
  return options;
}

/** "19:30" → "20:30"；超過 24:00 回傳 24:00 */
export function addOneHour(time: string): string {
  const total = Math.min(Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + 60, 24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
