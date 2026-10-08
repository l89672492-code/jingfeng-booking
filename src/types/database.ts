/**
 * Supabase 資料庫型別，對應 supabase/migrations。
 * 修改 migration 後請同步更新；也可用 Supabase CLI 重新產生：
 *   npx supabase gen types typescript --linked > src/types/database.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type CourtStatus = "active" | "inactive";
export type DayType = "weekday" | "holiday";
export type PricingDayType = DayType | "special";
export type StaffRole = "admin" | "staff";

export type BookingRow = {
  id: string;
  booking_number: string;
  court_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  price: number;
  status: BookingStatus;
  note: string | null;
  source: "customer" | "admin";
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CourtRow = {
  id: string;
  name: string;
  status: CourtStatus;
  sort_order: number;
  created_at: string;
};

export type PricingRuleRow = {
  id: string;
  day_type: PricingDayType;
  special_date: string | null;
  start_time: string;
  end_time: string;
  price: number;
  member_price: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type BlockedSlotRow = {
  id: string;
  court_id: string | null;
  blocked_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  created_at: string;
};

export type BusinessHoursRow = {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
};

export type HolidayRow = {
  id: string;
  holiday_date: string;
  name: string;
  is_closed: boolean;
  day_type: DayType | null;
  created_at: string;
};

export type SystemSettingRow = {
  key: string;
  value: string;
  description: string;
  is_public: boolean;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  name: string;
  role: StaffRole;
  created_at: string;
};

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type DateStatus = "open" | "closed" | "past" | "unavailable";
export type SlotStatus = "available" | "booked" | "blocked" | "past" | "closed";

export type DayAvailabilityRow = {
  court_id: string;
  court_name: string;
  sort_order: number;
  start_time: string;
  end_time: string;
  status: SlotStatus;
  price: number | null;
};

export type CustomerBookingRow = {
  booking_number: string;
  court_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  price: number;
  status: BookingStatus;
  customer_name: string;
  customer_phone: string;
  can_cancel: boolean;
  cancel_deadline: string;
};

type AdminBookingArgs = {
  p_court_id: string;
  p_booking_date: string;
  p_start_time: string;
  p_end_time: string;
  p_customer_name: string;
  p_customer_phone: string;
  p_customer_email?: string | null;
  p_note?: string | null;
  p_price?: number | null;
  p_status?: BookingStatus;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id" | "role">;
      courts: Table<CourtRow, "name">;
      business_hours: Table<BusinessHoursRow, "day_of_week" | "open_time" | "close_time">;
      holidays: Table<HolidayRow, "holiday_date" | "name">;
      pricing_rules: Table<
        PricingRuleRow,
        "day_type" | "start_time" | "end_time" | "price"
      >;
      blocked_slots: Table<BlockedSlotRow, "blocked_date">;
      system_settings: Table<SystemSettingRow, "key" | "value">;
      bookings: Table<
        BookingRow,
        | "booking_number"
        | "court_id"
        | "booking_date"
        | "start_time"
        | "end_time"
        | "customer_name"
        | "customer_phone"
        | "price"
      >;
    };
    Views: Record<string, never>;
    Functions: {
      get_date_statuses: {
        Args: { p_from: string; p_to: string };
        Returns: { date: string; status: DateStatus; holiday_name: string | null }[];
      };
      get_day_availability: {
        Args: { p_date: string };
        Returns: DayAvailabilityRow[];
      };
      calculate_price: {
        Args: { p_date: string; p_start: string; p_end: string };
        Returns: number | null;
      };
      create_booking: {
        Args: {
          p_court_id: string;
          p_booking_date: string;
          p_start_time: string;
          p_end_time: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_customer_email?: string | null;
          p_note?: string | null;
        };
        Returns: BookingRow;
      };
      get_customer_booking: {
        Args: { p_booking_number: string; p_phone: string };
        Returns: CustomerBookingRow[];
      };
      cancel_customer_booking: {
        Args: { p_booking_number: string; p_phone: string };
        Returns: BookingRow;
      };
      complete_finished_bookings: {
        Args: Record<string, never>;
        Returns: number;
      };
      admin_create_booking: {
        Args: AdminBookingArgs;
        Returns: BookingRow;
      };
      admin_update_booking: {
        Args: Required<AdminBookingArgs> & { p_booking_id: string };
        Returns: BookingRow;
      };
      admin_cancel_booking: {
        Args: { p_booking_id: string };
        Returns: BookingRow;
      };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
