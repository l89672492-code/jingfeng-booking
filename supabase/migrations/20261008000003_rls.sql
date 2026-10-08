-- =====================================================================
-- 勁丰羽球館｜場地預約系統 — Row Level Security
--
-- 訪客（anon）：
--   * 可讀：場地、營業時間、休館日、啟用中的價格、關閉時段、公開設定
--   * 不可讀：任何預約資料（姓名、電話等個資）
--   * 不可寫：任何資料表。建立／查詢／取消預約只能透過 server 呼叫的函式。
-- 後台人員（profiles.role = admin / staff）：
--   * staff：查看所有預約、管理關閉時段；預約的新增／修改／取消透過 admin_* 函式
--   * admin：另外可管理場地、價格、營業時間、休館日、系統設定
-- service_role（secret key）會略過 RLS，只在 server 端使用。
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.courts enable row level security;
alter table public.business_hours enable row level security;
alter table public.holidays enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.system_settings enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_number_counters enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy "profiles: read own or admin"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------
-- courts
-- ---------------------------------------------------------------------
create policy "courts: public read"
  on public.courts for select
  to anon, authenticated
  using (true);

create policy "courts: admin write"
  on public.courts for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- business_hours
-- ---------------------------------------------------------------------
create policy "business_hours: public read"
  on public.business_hours for select
  to anon, authenticated
  using (true);

create policy "business_hours: admin write"
  on public.business_hours for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- holidays
-- ---------------------------------------------------------------------
create policy "holidays: public read"
  on public.holidays for select
  to anon, authenticated
  using (true);

create policy "holidays: admin write"
  on public.holidays for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- pricing_rules
-- ---------------------------------------------------------------------
create policy "pricing_rules: public read active"
  on public.pricing_rules for select
  to anon, authenticated
  using (active or (select public.is_staff()));

create policy "pricing_rules: admin write"
  on public.pricing_rules for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- blocked_slots
-- ---------------------------------------------------------------------
create policy "blocked_slots: public read"
  on public.blocked_slots for select
  to anon, authenticated
  using (true);

create policy "blocked_slots: staff write"
  on public.blocked_slots for all
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- ---------------------------------------------------------------------
-- system_settings
-- ---------------------------------------------------------------------
create policy "system_settings: read public or staff"
  on public.system_settings for select
  to anon, authenticated
  using (is_public or (select public.is_staff()));

create policy "system_settings: admin write"
  on public.system_settings for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- bookings：只有後台人員可以讀取；寫入一律透過函式
-- ---------------------------------------------------------------------
create policy "bookings: staff read"
  on public.bookings for select
  to authenticated
  using ((select public.is_staff()));

-- booking_number_counters：不建立任何 policy（僅函式內部使用）

-- ---------------------------------------------------------------------
-- 資料表權限（第二道防線）：即使 policy 設定錯誤，訪客也無法直接寫入
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate on public.bookings from anon, authenticated;
revoke all on public.booking_number_counters from anon, authenticated;
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
revoke insert, update, delete, truncate
  on public.courts, public.business_hours, public.holidays,
     public.pricing_rules, public.blocked_slots, public.system_settings
  from anon;
