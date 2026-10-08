import type { BookingStatus } from "@/types/database";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "待確認",
  confirmed: "已確認",
  cancelled: "已取消",
  completed: "已完成",
};

export const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-zinc-200 text-zinc-600",
  completed: "bg-brand-100 text-brand-800",
};
