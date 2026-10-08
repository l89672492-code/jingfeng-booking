/**
 * 後台下拉選單用的整點選項（00:00–24:00）。
 * 實際可預約的時段仍由資料庫依營業時間判斷，這裡只是輸入選項。
 */
export function hourlyOptions(fromHour = 0, toHour = 24): string[] {
  const options: string[] = [];
  for (let hour = fromHour; hour <= toHour; hour += 1) {
    options.push(`${String(hour).padStart(2, "0")}:00`);
  }
  return options;
}

/** "19:00" → "20:00"；超過 24:00 回傳 24:00 */
export function addOneHour(time: string): string {
  const hour = Math.min(Number(time.slice(0, 2)) + 1, 24);
  return `${String(hour).padStart(2, "0")}:00`;
}
