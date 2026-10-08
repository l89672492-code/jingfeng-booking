/**
 * 預約核心邏輯測試（直接對 migration 建出的 PostgreSQL 執行）。
 */
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { addDays, dayOfWeek, taipeiToday } from "@/lib/booking/dates";

import {
  asRole,
  createStaffUser,
  createTestDatabase,
  getCourtId,
  resetData,
} from "./harness";

let db: PGlite;
let courtA: string;
let courtB: string;

/** 找出 minDaysAhead 天後第一個符合星期的日期 */
function nextDate(days: number[], minDaysAhead = 2): string {
  let date = addDays(taipeiToday(), minDaysAhead);
  while (!days.includes(dayOfWeek(date))) date = addDays(date, 1);
  return date;
}
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

type BookingRow = {
  id: string;
  booking_number: string;
  price: number;
  status: string;
  court_id: string;
};

/** 以 server（service_role）身分呼叫 create_booking */
function createBooking(
  params: {
    courtId: string;
    date: string;
    start: string;
    end: string;
    name?: string;
    phone?: string;
    email?: string | null;
  },
  tx?: Transaction,
) {
  const run = (t: Transaction) =>
    t
      .query<BookingRow>(
        "select * from public.create_booking($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          params.courtId,
          params.date,
          params.start,
          params.end,
          params.name ?? "王小明",
          params.phone ?? "0912345678",
          params.email ?? null,
          null,
        ],
      )
      .then((result) => result.rows[0]);
  return tx ? run(tx) : asRole(db, "service_role", null, run);
}

beforeAll(async () => {
  db = await createTestDatabase();
  courtA = await getCourtId(db, "A場");
  courtB = await getCourtId(db, "B場");
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await resetData(db);
});

describe("seed data", () => {
  it("建立 A–E 五面場、營業時間、價格與設定", async () => {
    const courts = await db.query<{ name: string }>(
      "select name from public.courts order by sort_order",
    );
    expect(courts.rows.map((row) => row.name)).toEqual(["A場", "B場", "C場", "D場", "E場"]);

    const hours = await db.query("select * from public.business_hours");
    expect(hours.rows).toHaveLength(7);

    const rules = await db.query("select * from public.pricing_rules where active");
    expect(rules.rows).toHaveLength(5);

    const settings = await db.query<{ key: string }>("select key from public.system_settings");
    expect(settings.rows.map((row) => row.key)).toEqual(
      expect.arrayContaining([
        "cancellation_deadline_hours",
        "booking_max_days_ahead",
        "facility_name",
        "facility_phone",
        "facility_address",
        "facility_line",
      ]),
    );
  });
});

describe("建立預約", () => {
  it("1. 正常預約成功：產生預約編號、由資料庫計算價格、狀態為 confirmed", async () => {
    const date = nextDate(WEEKDAYS);
    const booking = await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });

    const today = taipeiToday().replaceAll("-", "");
    expect(booking.booking_number).toBe(`JF${today}0001`);
    expect(booking.price).toBe(500);
    expect(booking.status).toBe("confirmed");

    const second = await createBooking({ courtId: courtA, date, start: "20:00", end: "21:00" });
    expect(second.booking_number).toBe(`JF${today}0002`);
  });

  it("2. 相同場地相同時間不能重複預約", async () => {
    const date = nextDate(WEEKDAYS);
    await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    await expect(
      createBooking({ courtId: courtA, date, start: "19:00", end: "20:00", phone: "0922333444" }),
    ).rejects.toThrow("BOOKING_CONFLICT");
  });

  it("2b. 即使略過應用程式檢查直接寫入，排除約束仍會擋下重疊預約", async () => {
    const date = nextDate(WEEKDAYS);
    await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    // 以最高權限直接 INSERT（模擬兩個請求都通過了事前檢查的競態情況）
    await expect(
      db.query(
        `insert into public.bookings
           (booking_number, court_id, booking_date, start_time, end_time,
            customer_name, customer_phone, price)
         values ('JF209901010001', $1, $2, '19:30', '20:30', '測試', '0912345678', 500)`,
        [courtA, date],
      ),
    ).rejects.toThrow(/bookings_no_overlap/);
  });

  it("3. 不同場地同時間可以預約", async () => {
    const date = nextDate(WEEKDAYS);
    await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    const booking = await createBooking({ courtId: courtB, date, start: "19:00", end: "20:00" });
    expect(booking.status).toBe("confirmed");
  });

  it("3b. 相鄰時段（19:00–20:00 與 20:00–21:00）不算撞場", async () => {
    const date = nextDate(WEEKDAYS);
    await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    const booking = await createBooking({ courtId: courtA, date, start: "20:00", end: "21:00" });
    expect(booking.status).toBe("confirmed");
  });

  it("4. 不同日期可以預約", async () => {
    const date = nextDate(WEEKDAYS);
    await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    const booking = await createBooking({
      courtId: courtA,
      date: addDays(date, 1),
      start: "19:00",
      end: "20:00",
    });
    expect(booking.status).toBe("confirmed");
  });

  it("5. 已取消預約後可以重新租", async () => {
    const date = nextDate(WEEKDAYS);
    const first = await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    await asRole(db, "service_role", null, (tx) =>
      tx.query("select * from public.cancel_customer_booking($1, $2)", [
        first.booking_number,
        "0912345678",
      ]),
    );
    const again = await createBooking({
      courtId: courtA,
      date,
      start: "19:00",
      end: "20:00",
      phone: "0922333444",
    });
    expect(again.status).toBe("confirmed");
  });

  it("6. 過去日期不能預約", async () => {
    const yesterday = addDays(taipeiToday(), -1);
    await expect(
      createBooking({ courtId: courtA, date: yesterday, start: "19:00", end: "20:00" }),
    ).rejects.toThrow("DATE_IN_PAST");
  });

  it("6b. 超過可預約天數不能預約", async () => {
    const farAway = addDays(taipeiToday(), 31);
    await expect(
      createBooking({ courtId: courtA, date: farAway, start: "19:00", end: "20:00" }),
    ).rejects.toThrow("DATE_TOO_FAR");
  });

  it("7. 休館日不能預約", async () => {
    const date = nextDate(WEEKDAYS);
    await db.query(
      "insert into public.holidays (holiday_date, name, is_closed) values ($1, '國慶日', true)",
      [date],
    );
    await expect(
      createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" }),
    ).rejects.toThrow("FACILITY_CLOSED");
  });

  it("8. 停用的場地不能預約", async () => {
    const date = nextDate(WEEKDAYS);
    await db.query("update public.courts set status = 'inactive' where id = $1", [courtA]);
    await expect(
      createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" }),
    ).rejects.toThrow("COURT_UNAVAILABLE");
  });

  it("8b. 關閉時段不能預約（指定場地與整館）", async () => {
    const date = nextDate(WEEKDAYS);
    await db.query(
      `insert into public.blocked_slots (court_id, blocked_date, start_time, end_time, reason)
       values ($1, $2, '14:00', '17:00', '場地維修')`,
      [courtA, date],
    );
    await expect(
      createBooking({ courtId: courtA, date, start: "15:00", end: "16:00" }),
    ).rejects.toThrow("SLOT_BLOCKED");
    // 其他場地不受影響
    await expect(
      createBooking({ courtId: courtB, date, start: "15:00", end: "16:00" }),
    ).resolves.toMatchObject({ status: "confirmed" });

    // 整館整天關閉
    await db.query(
      "insert into public.blocked_slots (court_id, blocked_date, reason) values (null, $1, '包場')",
      [addDays(date, 1)],
    );
    await expect(
      createBooking({ courtId: courtB, date: addDays(date, 1), start: "10:00", end: "11:00" }),
    ).rejects.toThrow("SLOT_BLOCKED");
  });

  it("9. 非營業時間不能預約", async () => {
    const date = nextDate(WEEKDAYS);
    await expect(
      createBooking({ courtId: courtA, date, start: "08:00", end: "09:00" }),
    ).rejects.toThrow("OUTSIDE_BUSINESS_HOURS");
    await expect(
      createBooking({ courtId: courtA, date, start: "22:00", end: "23:00" }),
    ).rejects.toThrow("OUTSIDE_BUSINESS_HOURS");
    // 不對齊整點、或一次超過一個時段
    await expect(
      createBooking({ courtId: courtA, date, start: "19:30", end: "20:30" }),
    ).rejects.toThrow("INVALID_TIME");
    await expect(
      createBooking({ courtId: courtA, date, start: "19:00", end: "21:00" }),
    ).rejects.toThrow("INVALID_TIME");
  });

  it("驗證姓名、手機與 Email", async () => {
    const date = nextDate(WEEKDAYS);
    await expect(
      createBooking({ courtId: courtA, date, start: "19:00", end: "20:00", name: "  " }),
    ).rejects.toThrow("INVALID_NAME");
    await expect(
      createBooking({ courtId: courtA, date, start: "19:00", end: "20:00", phone: "0212345678" }),
    ).rejects.toThrow("INVALID_PHONE");
    await expect(
      createBooking({ courtId: courtA, date, start: "19:00", end: "20:00", email: "abc" }),
    ).rejects.toThrow("INVALID_EMAIL");

    const booking = await createBooking({
      courtId: courtA,
      date,
      start: "19:00",
      end: "20:00",
      phone: "0912-345-678",
    });
    const stored = await db.query<{ customer_phone: string }>(
      "select customer_phone from public.bookings where id = $1",
      [booking.id],
    );
    expect(stored.rows[0].customer_phone).toBe("0912345678");
  });
});

describe("價格", () => {
  async function price(date: string, start: string, end: string) {
    const result = await asRole(db, "anon", null, (tx) =>
      tx.query<{ price: number | null }>(
        "select public.calculate_price($1, $2, $3) as price",
        [date, start, end],
      ),
    );
    return result.rows[0].price;
  }

  it("平日：09–18 為 350，18–22 為 500", async () => {
    const date = nextDate(WEEKDAYS);
    expect(await price(date, "09:00", "10:00")).toBe(350);
    expect(await price(date, "17:00", "18:00")).toBe(350);
    expect(await price(date, "18:00", "19:00")).toBe(500);
    expect(await price(date, "21:00", "22:00")).toBe(500);
  });

  it("假日：09–12 為 500，12–14 為 350，14–22 為 500", async () => {
    const date = nextDate(WEEKEND);
    expect(await price(date, "09:00", "10:00")).toBe(500);
    expect(await price(date, "12:00", "13:00")).toBe(350);
    expect(await price(date, "13:00", "14:00")).toBe(350);
    expect(await price(date, "14:00", "15:00")).toBe(500);
  });

  it("國定假日設為假日時，以假日價格計算", async () => {
    const date = nextDate(WEEKDAYS);
    await db.query(
      "insert into public.holidays (holiday_date, name, is_closed, day_type) values ($1, '連假', false, 'holiday')",
      [date],
    );
    expect(await price(date, "10:00", "11:00")).toBe(500);
  });

  it("特殊日期價格優先於假日與平日", async () => {
    const date = nextDate(WEEKEND);
    await db.query(
      `insert into public.pricing_rules (day_type, special_date, start_time, end_time, price)
       values ('special', $1, '09:00', '12:00', 400)`,
      [date],
    );
    expect(await price(date, "10:00", "11:00")).toBe(400);
    // 特殊規則沒涵蓋的時段，回到假日價格
    expect(await price(date, "15:00", "16:00")).toBe(500);
  });

  it("停用的價格規則不會被使用", async () => {
    const date = nextDate(WEEKDAYS);
    await db.query(
      "update public.pricing_rules set active = false where day_type = 'weekday' and start_time = '18:00'",
    );
    expect(await price(date, "19:00", "20:00")).toBeNull();
    await expect(
      createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" }),
    ).rejects.toThrow("PRICE_NOT_FOUND");
    await db.query("update public.pricing_rules set active = true");
  });

  it("10. 前端竄改價格不能成功：訪客無法直接寫入 bookings，也無法呼叫 create_booking", async () => {
    const date = nextDate(WEEKDAYS);
    await expect(
      asRole(db, "anon", null, (tx) =>
        tx.query(
          `insert into public.bookings
             (booking_number, court_id, booking_date, start_time, end_time,
              customer_name, customer_phone, price)
           values ('JF209901010001', $1, $2, '19:00', '20:00', '測試', '0912345678', 1)`,
          [courtA, date],
        ),
      ),
    ).rejects.toThrow(/permission denied/);

    await expect(
      asRole(db, "anon", null, (tx) =>
        tx.query("select * from public.create_booking($1, $2, '19:00', '20:00', '測試', '0912345678')", [
          courtA,
          date,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);

    // 唯一的建立管道 create_booking 沒有價格參數，價格一律由資料庫計算
    const booking = await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    expect(booking.price).toBe(500);
  });
});

describe("可預約狀態查詢", () => {
  it("回傳每個場地每個時段的狀態，且不含顧客資料", async () => {
    const date = nextDate(WEEKDAYS);
    await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    await db.query("update public.courts set status = 'inactive' where id = $1", [courtB]);

    const result = await asRole(db, "anon", null, (tx) =>
      tx.query<{ court_name: string; start_time: string; status: string; price: number }>(
        "select * from public.get_day_availability($1)",
        [date],
      ),
    );
    expect(result.rows).toHaveLength(13 * 5);
    expect(Object.keys(result.rows[0]).sort()).toEqual(
      ["court_id", "court_name", "end_time", "price", "sort_order", "start_time", "status"].sort(),
    );

    const at19 = result.rows.filter((row) => row.start_time === "19:00:00");
    expect(at19.find((row) => row.court_name === "A場")?.status).toBe("booked");
    expect(at19.find((row) => row.court_name === "B場")?.status).toBe("blocked");
    expect(at19.find((row) => row.court_name === "C場")?.status).toBe("available");
    expect(at19.find((row) => row.court_name === "C場")?.price).toBe(500);
  });

  it("休館日顯示 closed", async () => {
    const date = nextDate(WEEKDAYS);
    await db.query(
      "insert into public.holidays (holiday_date, name, is_closed) values ($1, '國慶日', true)",
      [date],
    );
    const statuses = await asRole(db, "anon", null, (tx) =>
      tx.query<{ status: string }>("select * from public.get_date_statuses($1, $1)", [date]),
    );
    expect(statuses.rows[0].status).toBe("closed");

    const slots = await asRole(db, "anon", null, (tx) =>
      tx.query<{ status: string }>("select * from public.get_day_availability($1)", [date]),
    );
    expect(slots.rows.every((row) => row.status === "closed")).toBe(true);
  });

  it("過去日期顯示 past", async () => {
    const yesterday = addDays(taipeiToday(), -1);
    const statuses = await asRole(db, "anon", null, (tx) =>
      tx.query<{ status: string }>("select * from public.get_date_statuses($1, $1)", [yesterday]),
    );
    expect(statuses.rows[0].status).toBe("past");
  });
});

describe("查詢與取消預約", () => {
  it("必須同時符合預約編號與手機才查得到", async () => {
    const date = nextDate(WEEKDAYS);
    const booking = await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });

    const found = await asRole(db, "service_role", null, (tx) =>
      tx.query<{ court_name: string; can_cancel: boolean }>(
        "select * from public.get_customer_booking($1, $2)",
        [booking.booking_number.toLowerCase(), "0912-345-678"],
      ),
    );
    expect(found.rows).toHaveLength(1);
    expect(found.rows[0].court_name).toBe("A場");
    expect(found.rows[0].can_cancel).toBe(true);

    const wrongPhone = await asRole(db, "service_role", null, (tx) =>
      tx.query("select * from public.get_customer_booking($1, $2)", [
        booking.booking_number,
        "0999999999",
      ]),
    );
    expect(wrongPhone.rows).toHaveLength(0);
  });

  it("超過取消期限不能取消（期限由 cancellation_deadline_hours 設定）", async () => {
    const date = nextDate(WEEKDAYS);
    const booking = await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    // 把期限設得比距離開賽時間還長
    await db.query(
      "update public.system_settings set value = '1000' where key = 'cancellation_deadline_hours'",
    );
    await expect(
      asRole(db, "service_role", null, (tx) =>
        tx.query("select * from public.cancel_customer_booking($1, $2)", [
          booking.booking_number,
          "0912345678",
        ]),
      ),
    ).rejects.toThrow("CANCEL_DEADLINE_PASSED");
  });

  it("取消後狀態為 cancelled，不能重複取消", async () => {
    const date = nextDate(WEEKDAYS);
    const booking = await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    const cancel = () =>
      asRole(db, "service_role", null, (tx) =>
        tx.query<{ status: string }>("select * from public.cancel_customer_booking($1, $2)", [
          booking.booking_number,
          "0912345678",
        ]),
      );
    const result = await cancel();
    expect(result.rows[0].status).toBe("cancelled");
    await expect(cancel()).rejects.toThrow("ALREADY_CANCELLED");
  });
});

describe("權限與後台", () => {
  it("11. 訪客與一般登入者都不能讀取預約資料", async () => {
    const date = nextDate(WEEKDAYS);
    await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });

    const anon = await asRole(db, "anon", null, (tx) =>
      tx.query("select * from public.bookings"),
    ).catch((error: Error) => error);
    // anon 對 bookings 只有 select 權限，但 RLS 沒有任何 anon policy → 0 筆
    expect(anon).not.toBeInstanceOf(Error);
    expect((anon as { rows: unknown[] }).rows).toHaveLength(0);

    const outsider = await createStaffUser(db, null);
    const asOutsider = await asRole(db, "authenticated", outsider, (tx) =>
      tx.query("select * from public.bookings"),
    );
    expect(asOutsider.rows).toHaveLength(0);

    const staff = await createStaffUser(db, "staff");
    const asStaff = await asRole(db, "authenticated", staff, (tx) =>
      tx.query("select * from public.bookings"),
    );
    expect(asStaff.rows).toHaveLength(1);
  });

  it("11b. 非後台人員不能呼叫後台函式、不能修改價格", async () => {
    const outsider = await createStaffUser(db, null);
    await expect(
      asRole(db, "authenticated", outsider, (tx) =>
        tx.query("select * from public.admin_cancel_booking($1)", [crypto.randomUUID()]),
      ),
    ).rejects.toThrow("FORBIDDEN");

    const updated = await asRole(db, "authenticated", outsider, (tx) =>
      tx.query("update public.pricing_rules set price = 1 returning id"),
    );
    expect(updated.rows).toHaveLength(0);

    // staff 也不能改價格（僅 admin）
    const staff = await createStaffUser(db, "staff");
    const staffUpdate = await asRole(db, "authenticated", staff, (tx) =>
      tx.query("update public.pricing_rules set price = 1 returning id"),
    );
    expect(staffUpdate.rows).toHaveLength(0);

    const admin = await createStaffUser(db, "admin");
    const adminUpdate = await asRole(db, "authenticated", admin, (tx) =>
      tx.query(
        "update public.pricing_rules set price = 360 where day_type = 'weekday' and start_time = '09:00' returning id",
      ),
    );
    expect(adminUpdate.rows).toHaveLength(1);
    await db.query(
      "update public.pricing_rules set price = 350 where day_type = 'weekday' and start_time = '09:00'",
    );
  });

  it("管理員新增預約也必須經過防撞場檢查", async () => {
    const date = nextDate(WEEKDAYS);
    await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    const admin = await createStaffUser(db, "admin");
    await expect(
      asRole(db, "authenticated", admin, (tx) =>
        tx.query(
          "select * from public.admin_create_booking($1, $2, '19:00', '21:00', '陳先生', '0223456789')",
          [courtA, date],
        ),
      ),
    ).rejects.toThrow("BOOKING_CONFLICT");

    // 管理員可以一次登記兩小時，可輸入市話
    const created = await asRole(db, "authenticated", admin, (tx) =>
      tx.query<BookingRow>(
        "select * from public.admin_create_booking($1, $2, '19:00', '21:00', '陳先生', '0223456789')",
        [courtB, date],
      ),
    );
    expect(created.rows[0].price).toBe(1000);
  });

  it("12. 管理員修改場地後會重新檢查撞場", async () => {
    const date = nextDate(WEEKDAYS);
    await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    const onB = await createBooking({
      courtId: courtB,
      date,
      start: "19:00",
      end: "20:00",
      phone: "0922333444",
    });

    const admin = await createStaffUser(db, "admin");
    const update = (courtId: string, start: string, end: string) =>
      asRole(db, "authenticated", admin, (tx) =>
        tx.query<BookingRow>(
          `select * from public.admin_update_booking(
             $1, $2, $3, $4, $5, '王小明', '0922333444', null, null, null, 'confirmed')`,
          [onB.id, courtId, date, start, end],
        ),
      );

    // B 場改到 A 場同時段 → 撞場
    await expect(update(courtA, "19:00", "20:00")).rejects.toThrow("BOOKING_CONFLICT");
    // 改到 A 場其他時段 → 成功
    const moved = await update(courtA, "20:00", "21:00");
    expect(moved.rows[0].court_id).toBe(courtA);
  });

  it("管理員恢復已取消的預約時，也會重新檢查撞場", async () => {
    const date = nextDate(WEEKDAYS);
    const first = await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00" });
    const admin = await createStaffUser(db, "admin");
    await asRole(db, "authenticated", admin, (tx) =>
      tx.query("select * from public.admin_cancel_booking($1)", [first.id]),
    );
    await createBooking({ courtId: courtA, date, start: "19:00", end: "20:00", phone: "0922333444" });

    await expect(
      asRole(db, "authenticated", admin, (tx) =>
        tx.query(
          `select * from public.admin_update_booking(
             $1, $2, $3, '19:00', '20:00', '王小明', '0912345678', null, null, null, 'confirmed')`,
          [first.id, courtA, date],
        ),
      ),
    ).rejects.toThrow("BOOKING_CONFLICT");
  });
});
