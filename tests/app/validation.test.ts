import { describe, expect, it } from "vitest";

import { GENERIC_ERROR_MESSAGE, getErrorMessage } from "@/lib/booking/errors";
import {
  adminBookingSchema,
  bookingLookupSchema,
  customerBookingSchema,
  normalizePhone,
} from "@/lib/booking/validation";

const validInput = {
  courtId: "8f14e45f-ceea-4e7a-9b3a-1c2d3e4f5a6b",
  date: "2026-10-15",
  startTime: "19:00",
  endTime: "20:00",
  name: "王小明",
  phone: "0912345678",
};

describe("球友預約表單驗證", () => {
  it("10. 前端竄改的 price 會被丟棄，server 不會收到", () => {
    const parsed = customerBookingSchema.parse({ ...validInput, price: 1 });
    expect(parsed).not.toHaveProperty("price");
  });

  it("姓名必填、去除前後空白", () => {
    expect(customerBookingSchema.safeParse({ ...validInput, name: "   " }).success).toBe(false);
    expect(customerBookingSchema.parse({ ...validInput, name: " 王小明 " }).name).toBe("王小明");
  });

  it("手機必須是台灣手機格式，並正規化", () => {
    expect(customerBookingSchema.safeParse({ ...validInput, phone: "0212345678" }).success).toBe(false);
    expect(customerBookingSchema.safeParse({ ...validInput, phone: "091234567" }).success).toBe(false);
    expect(customerBookingSchema.parse({ ...validInput, phone: "0912-345-678" }).phone).toBe("0912345678");
    expect(customerBookingSchema.parse({ ...validInput, phone: "+886912345678" }).phone).toBe("0912345678");
  });

  it("Email 非必填，有填就要格式正確", () => {
    expect(customerBookingSchema.parse({ ...validInput, email: "" }).email).toBeUndefined();
    expect(customerBookingSchema.safeParse({ ...validInput, email: "abc" }).success).toBe(false);
    expect(customerBookingSchema.parse({ ...validInput, email: "a@b.tw" }).email).toBe("a@b.tw");
  });

  it("日期與時間必須合法", () => {
    expect(customerBookingSchema.safeParse({ ...validInput, date: "2026-02-30" }).success).toBe(false);
    expect(customerBookingSchema.safeParse({ ...validInput, startTime: "25:00" }).success).toBe(false);
    expect(
      customerBookingSchema.safeParse({ ...validInput, startTime: "20:00", endTime: "19:00" }).success,
    ).toBe(false);
  });

  it("場地必須是 UUID", () => {
    expect(customerBookingSchema.safeParse({ ...validInput, courtId: "A" }).success).toBe(false);
  });
});

describe("查詢預約驗證", () => {
  it("預約編號格式 JF + 12 位數字，自動轉大寫", () => {
    expect(
      bookingLookupSchema.parse({ bookingNumber: "jf202610150001", phone: "0912345678" }).bookingNumber,
    ).toBe("JF202610150001");
    expect(bookingLookupSchema.safeParse({ bookingNumber: "JF123", phone: "0912345678" }).success).toBe(false);
  });
});

describe("後台預約驗證", () => {
  it("後台可輸入市話，費用留白代表依規則計算", () => {
    const parsed = adminBookingSchema.parse({
      ...validInput,
      phone: "02-2345-6789",
      price: "",
      status: "confirmed",
    });
    expect(parsed.phone).toBe("0223456789");
    expect(parsed.price).toBeUndefined();
  });

  it("費用不可為負數或小數", () => {
    const base = { ...validInput, status: "confirmed" };
    expect(adminBookingSchema.safeParse({ ...base, price: "-1" }).success).toBe(false);
    expect(adminBookingSchema.safeParse({ ...base, price: "1.5" }).success).toBe(false);
    expect(adminBookingSchema.parse({ ...base, price: "800" }).price).toBe(800);
  });
});

describe("錯誤訊息", () => {
  it("撞場顯示指定的中文訊息", () => {
    expect(getErrorMessage({ message: "BOOKING_CONFLICT" })).toBe(
      "這個場地剛剛已被其他球友預約，請重新選擇。",
    );
  });

  it("未知的資料庫錯誤不顯示技術細節", () => {
    expect(getErrorMessage({ message: 'relation "bookings" does not exist' })).toBe(GENERIC_ERROR_MESSAGE);
    expect(GENERIC_ERROR_MESSAGE).toBe(
      "目前系統暫時無法完成預約，請稍後再試或直接聯絡勁丰羽球館。",
    );
  });
});

describe("normalizePhone", () => {
  it("移除空白與符號", () => {
    expect(normalizePhone(" 0912 345 678 ")).toBe("0912345678");
    expect(normalizePhone("(02)2345-6789")).toBe("0223456789");
  });
});
