/**
 * 表單驗證（zod）。前端用來即時提示，server 端會再驗證一次，
 * 最後資料庫函式還會做第三次檢查。
 */
import { z } from "zod";

import { isValidIsoDate } from "./dates";

/** 移除空白、橫線、括號；+886 開頭轉成 0 開頭 */
export function normalizePhone(value: string): string {
  const digits = value.replace(/[\s()-]/g, "");
  return digits.replace(/^\+?886/, "0");
}

export const TAIWAN_MOBILE_PATTERN = /^09\d{8}$/;
/** 後台可輸入市話：0 開頭 9–10 碼 */
export const TAIWAN_PHONE_PATTERN = /^0\d{8,9}$/;

const isoDate = z
  .string()
  .trim()
  .refine(isValidIsoDate, "請選擇正確的日期");

const time = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-4]):[0-5]\d(:00)?$/, "請選擇正確的時間")
  .transform((value) => value.slice(0, 5));

const customerName = z
  .string()
  .trim()
  .min(1, "請輸入姓名")
  .max(50, "姓名最多 50 字");

const mobilePhone = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(TAIWAN_MOBILE_PATTERN, "請輸入正確的手機號碼，例如 0912345678"));

const anyPhone = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(TAIWAN_PHONE_PATTERN, "請輸入正確的電話號碼"));

/** 空字串視為未填 */
const optionalEmail = z
  .string()
  .trim()
  .max(254, "Email 太長")
  .optional()
  .transform((value) => (value ? value : undefined))
  .pipe(z.email("Email 格式不正確").optional());

const optionalNote = z
  .string()
  .trim()
  .max(500, "備註最多 500 字")
  .optional()
  .transform((value) => (value ? value : undefined));

const slotFields = {
  courtId: z.uuid("請選擇場地"),
  date: isoDate,
  startTime: time,
  endTime: time,
};

function endAfterStart(value: { startTime: string; endTime: string }) {
  return value.endTime > value.startTime;
}

/**
 * 球友預約表單。
 * 注意：這裡沒有 price 欄位，zod 會把前端多傳的欄位（例如 price）直接丟掉，
 * 價格一律由資料庫計算。
 */
export const customerBookingSchema = z
  .object({
    ...slotFields,
    name: customerName,
    phone: mobilePhone,
    email: optionalEmail,
    note: optionalNote,
  })
  .refine(endAfterStart, { message: "預約時段不正確", path: ["endTime"] });

export type CustomerBookingInput = z.infer<typeof customerBookingSchema>;

export const bookingLookupSchema = z.object({
  bookingNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^JF\d{12,}$/, "預約編號格式為 JF 加 12 位數字，例如 JF202610150001"),
  phone: mobilePhone,
});

export type BookingLookupInput = z.infer<typeof bookingLookupSchema>;

export const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;

/** 空白代表「依價格規則計算」 */
const optionalPrice = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce
    .number("費用必須是數字")
    .int("費用必須是整數")
    .min(0, "費用不可小於 0")
    .max(1_000_000, "費用太大")
    .optional(),
);

/** 後台新增／修改預約 */
export const adminBookingSchema = z
  .object({
    ...slotFields,
    name: customerName,
    phone: anyPhone,
    email: optionalEmail,
    note: optionalNote,
    price: optionalPrice,
    status: z.enum(BOOKING_STATUSES, "請選擇狀態"),
  })
  .refine(endAfterStart, { message: "結束時間必須晚於開始時間", path: ["endTime"] });

export type AdminBookingInput = z.infer<typeof adminBookingSchema>;

export const pricingRuleSchema = z
  .object({
    dayType: z.enum(["weekday", "holiday", "special"], "請選擇日期類型"),
    specialDate: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined))
      .pipe(isoDate.optional()),
    startTime: time,
    endTime: time,
    price: z.coerce.number("請輸入價格").int("價格必須是整數").min(0, "價格不可小於 0").max(100000),
    active: z.boolean(),
  })
  .refine(endAfterStart, { message: "結束時間必須晚於開始時間", path: ["endTime"] })
  .refine((value) => value.dayType !== "special" || Boolean(value.specialDate), {
    message: "特殊日期價格必須選擇日期",
    path: ["specialDate"],
  });

export type PricingRuleInput = z.infer<typeof pricingRuleSchema>;

export const courtSchema = z.object({
  name: z.string().trim().min(1, "請輸入場地名稱").max(20, "場地名稱最多 20 字"),
  sortOrder: z.coerce.number("請輸入排序").int().min(0).max(999),
  status: z.enum(["active", "inactive"]),
});

export const blockedSlotSchema = z
  .object({
    courtId: z
      .string()
      .optional()
      .transform((value) => (value ? value : undefined))
      .pipe(z.uuid().optional()),
    date: isoDate,
    allDay: z.boolean(),
    startTime: time.optional(),
    endTime: time.optional(),
    reason: z.string().trim().max(100, "原因最多 100 字"),
  })
  .refine(
    (value) =>
      value.allDay ||
      (value.startTime !== undefined &&
        value.endTime !== undefined &&
        value.endTime > value.startTime),
    { message: "請選擇正確的開始與結束時間", path: ["endTime"] },
  );

export const holidaySchema = z.object({
  date: isoDate,
  name: z.string().trim().min(1, "請輸入名稱").max(50, "名稱最多 50 字"),
  isClosed: z.boolean(),
  dayType: z
    .enum(["weekday", "holiday", ""])
    .transform((value) => (value === "" ? null : value)),
});

export const businessHoursSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    openTime: time,
    closeTime: time,
    isOpen: z.boolean(),
  })
  .refine((value) => value.closeTime > value.openTime, {
    message: "打烊時間必須晚於開門時間",
    path: ["closeTime"],
  });

/** zod 錯誤 → { 欄位: 第一個錯誤訊息 } */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
