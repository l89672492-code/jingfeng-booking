/** 場館聯絡連結工具 */

/** 電話撥號連結：0928-890-559 → tel:0928890559 */
export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** 官方 LINE 加好友連結 */
export function lineHref(lineId: string): string {
  return `https://line.me/R/ti/p/${encodeURIComponent(lineId)}`;
}
