import "server-only";

import { addDays, startOfWeek, monthRange } from "@/lib/booking/dates";
import type { AdminBookingInput } from "@/lib/booking/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/server/auth";
import { failure, type ActionResult } from "@/server/bookings";
import type { BookingRow, BookingStatus, CourtRow } from "@/types/database";

/**
 * 後台預約操作。
 * 讀取與寫入都使用「登入者自己的」Supabase client，因此同時受 RLS 與
 * 資料庫函式內的 is_staff() 檢查保護；唯一例外是 completeFinishedBookings。
 */

export type BookingWithCourt = BookingRow & { court_name: string };

export async function getCourts(): Promise<CourtRow[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courts")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data;
}

function withCourtNames(bookings: BookingRow[], courts: CourtRow[]): BookingWithCourt[] {
  const names = new Map(courts.map((court) => [court.id, court.name]));
  return bookings.map((booking) => ({
    ...booking,
    court_name: names.get(booking.court_id) ?? "—",
  }));
}

/** 已結束的 confirmed 預約標記為 completed（僅允許後台人員觸發） */
export async function completeFinishedBookings() {
  await requireStaff();
  try {
    const { error } = await createAdminClient().rpc("complete_finished_bookings");
    if (error) console.error("[completeFinishedBookings]", error);
  } catch (error) {
    // 缺少 secret key 時不影響後台其他功能
    console.error("[completeFinishedBookings]", error);
  }
}

export type BookingFilters = {
  from: string;
  to: string;
  status?: BookingStatus;
  keyword?: string;
};

export async function getBookings(filters: BookingFilters): Promise<BookingWithCourt[]> {
  await requireStaff();
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select("*")
    .gte("booking_date", filters.from)
    .lte("booking_date", filters.to)
    .order("booking_date")
    .order("start_time")
    .limit(500);

  if (filters.status) query = query.eq("status", filters.status);

  // 只保留文字與數字，避免影響 PostgREST 查詢語法
  const keyword = filters.keyword?.replace(/[^\p{L}\p{N}]/gu, "") ?? "";
  if (keyword) {
    query = query.or(
      `booking_number.ilike.%${keyword}%,customer_name.ilike.%${keyword}%,customer_phone.ilike.%${keyword}%`,
    );
  }

  const [{ data, error }, courts] = await Promise.all([query, getCourts()]);
  if (error) throw error;
  return withCourtNames(data, courts);
}

export async function getBookingById(id: string): Promise<BookingWithCourt | null> {
  await requireStaff();
  const supabase = await createClient();
  const [{ data, error }, courts] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", id).maybeSingle(),
    getCourts(),
  ]);
  if (error) throw error;
  return data ? withCourtNames([data], courts)[0] : null;
}

export type DashboardStats = {
  todayCount: number;
  todayRevenue: number;
  weekCount: number;
  monthCount: number;
  monthRevenue: number;
  todayBookings: BookingWithCourt[];
};

/** 後台首頁統計（不含已取消） */
export async function getDashboardStats(today: string): Promise<DashboardStats> {
  await requireStaff();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const month = monthRange(today.slice(0, 7));
  const from = weekStart < month.from ? weekStart : month.from;
  const to = weekEnd > month.to ? weekEnd : month.to;

  const supabase = await createClient();
  const [{ data, error }, courts] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .gte("booking_date", from)
      .lte("booking_date", to)
      .neq("status", "cancelled")
      .order("start_time"),
    getCourts(),
  ]);
  if (error) throw error;

  const bookings = withCourtNames(data, courts);
  const inRange = (start: string, end: string) =>
    bookings.filter((booking) => booking.booking_date >= start && booking.booking_date <= end);
  const sum = (rows: BookingRow[]) => rows.reduce((total, row) => total + row.price, 0);

  const todayBookings = inRange(today, today);
  const monthBookings = inRange(month.from, month.to);

  return {
    todayCount: todayBookings.length,
    todayRevenue: sum(todayBookings),
    weekCount: inRange(weekStart, weekEnd).length,
    monthCount: monthBookings.length,
    monthRevenue: sum(monthBookings),
    todayBookings,
  };
}

function bookingArgs(input: AdminBookingInput) {
  return {
    p_court_id: input.courtId,
    p_booking_date: input.date,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_customer_name: input.name,
    p_customer_phone: input.phone,
    p_customer_email: input.email ?? null,
    p_note: input.note ?? null,
    // 未填費用 → 資料庫依價格規則計算
    p_price: input.price ?? null,
    p_status: input.status,
  };
}

/** 管理員新增預約（資料庫同樣會做防撞場與營業時間等檢查） */
export async function createAdminBooking(
  input: AdminBookingInput,
): Promise<ActionResult<BookingRow>> {
  await requireStaff();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_create_booking", bookingArgs(input));
    if (error) return failure(error, "createAdminBooking");
    return { ok: true, data };
  } catch (error) {
    return failure(error, "createAdminBooking");
  }
}

/** 管理員修改預約（改日期／時間／場地時資料庫會重新檢查撞場） */
export async function updateBooking(
  id: string,
  input: AdminBookingInput,
): Promise<ActionResult<BookingRow>> {
  await requireStaff();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_update_booking", {
      p_booking_id: id,
      ...bookingArgs(input),
    });
    if (error) return failure(error, "updateBooking");
    return { ok: true, data };
  } catch (error) {
    return failure(error, "updateBooking");
  }
}

export async function cancelBookingAsAdmin(id: string): Promise<ActionResult<BookingRow>> {
  await requireStaff();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_cancel_booking", { p_booking_id: id });
    if (error) return failure(error, "cancelBookingAsAdmin");
    return { ok: true, data };
  } catch (error) {
    return failure(error, "cancelBookingAsAdmin");
  }
}
