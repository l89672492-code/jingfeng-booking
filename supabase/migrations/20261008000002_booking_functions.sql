-- =====================================================================
-- 勁丰羽球館｜場地預約系統 — 預約相關函式
--
-- 原則：
--   * 所有預約判斷（場地、日期、營業時間、休館、關閉時段、價格、撞場）
--     都在資料庫函式內重新驗證，不信任任何前端傳入的值。
--   * 價格一律由 calculate_price() 依資料庫中的價格規則計算，
--     球友端完全不接受外部傳入的價格。
--   * 錯誤以固定代碼（例如 BOOKING_CONFLICT）拋出，由應用程式轉成中文訊息。
--   * SECURITY DEFINER 函式皆設定 search_path = ''，並使用完整 schema 名稱，
--     避免 search_path 劫持。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 時間工具（台灣時間）
-- ---------------------------------------------------------------------
create or replace function public.taipei_now()
returns timestamp
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Taipei');
$$;

create or replace function public.taipei_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Taipei')::date;
$$;

create or replace function public.time_to_minutes(p_time time)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (extract(epoch from p_time) / 60)::integer;
$$;

-- 1440 分鐘 → 24:00（PostgreSQL time 型別允許 24:00:00）
create or replace function public.minutes_to_time(p_minutes integer)
returns time
language sql
immutable
set search_path = ''
as $$
  select case
    when p_minutes = 1440 then time '24:00'
    else make_time(p_minutes / 60, p_minutes % 60, 0)
  end;
$$;

-- ---------------------------------------------------------------------
-- 設定值讀取
-- ---------------------------------------------------------------------
create or replace function public.get_setting_int(p_key text, p_default integer)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_value text;
begin
  select s.value into v_value from public.system_settings s where s.key = p_key;
  if v_value is null or v_value !~ '^[0-9]+$' then
    return p_default;
  end if;
  return v_value::integer;
end;
$$;

-- ---------------------------------------------------------------------
-- 權限判斷
-- ---------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'staff')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- 日期類型：weekday（平日）或 holiday（假日）
--   1. holidays 有設定 day_type → 以設定為準（例如國定假日設為假日）
--   2. 星期六、星期日 → 假日
--   3. 其他 → 平日
-- （special 特殊價格在 calculate_price 內優先處理）
-- ---------------------------------------------------------------------
create or replace function public.resolve_day_type(p_date date)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day_type text;
begin
  select h.day_type into v_day_type
  from public.holidays h
  where h.holiday_date = p_date and h.day_type is not null;

  if v_day_type is not null then
    return v_day_type;
  end if;

  if extract(isodow from p_date) in (6, 7) then
    return 'holiday';
  end if;
  return 'weekday';
end;
$$;

-- ---------------------------------------------------------------------
-- 價格計算（server 端唯一的價格來源）
--   以 slot_duration_minutes 為單位逐段計價，每段找出完整涵蓋該段的規則：
--   特殊日期規則 > 該日的日期類型（假日／平日）規則。
--   任何一段找不到價格規則 → 回傳 null（不可預約）。
-- ---------------------------------------------------------------------
create or replace function public.calculate_price(p_date date, p_start time, p_end time)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slot integer := public.get_setting_int('slot_duration_minutes', 60);
  v_day_type text;
  v_start integer;
  v_end integer;
  v_minute integer;
  v_rate integer;
  v_total numeric := 0;
begin
  if p_date is null or p_start is null or p_end is null or v_slot <= 0 then
    return null;
  end if;

  v_start := public.time_to_minutes(p_start);
  v_end := public.time_to_minutes(p_end);
  if v_end <= v_start or (v_end - v_start) % v_slot <> 0 then
    return null;
  end if;

  v_day_type := public.resolve_day_type(p_date);
  v_minute := v_start;

  while v_minute < v_end loop
    select r.price into v_rate
    from public.pricing_rules r
    where r.active
      and (
        (r.day_type = 'special' and r.special_date = p_date)
        or (r.day_type = v_day_type and r.special_date is null)
      )
      and r.start_time <= public.minutes_to_time(v_minute)
      and r.end_time >= public.minutes_to_time(v_minute + v_slot)
    order by (r.day_type = 'special') desc, r.updated_at desc
    limit 1;

    if not found then
      return null;
    end if;

    -- 價格規則為「每小時價格」
    v_total := v_total + v_rate * v_slot / 60.0;
    v_minute := v_minute + v_slot;
  end loop;

  return round(v_total)::integer;
end;
$$;

-- ---------------------------------------------------------------------
-- 顧客資料正規化與驗證
--   p_mobile_only = true  → 只接受台灣手機 09xxxxxxxx（球友端）
--   p_mobile_only = false → 也接受市話（後台）
-- ---------------------------------------------------------------------
create or replace function public.normalize_customer(
  p_name text,
  p_phone text,
  p_email text,
  p_note text,
  p_mobile_only boolean,
  out name text,
  out phone text,
  out email text,
  out note text
)
language plpgsql
immutable
set search_path = ''
as $$
begin
  name := btrim(coalesce(p_name, ''));
  if length(name) < 1 or length(name) > 50 then
    raise exception 'INVALID_NAME';
  end if;

  phone := regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g');
  if phone ~ '^\+?886' then
    phone := '0' || regexp_replace(phone, '^\+?886', '');
  end if;
  if p_mobile_only then
    if phone !~ '^09[0-9]{8}$' then
      raise exception 'INVALID_PHONE';
    end if;
  elsif phone !~ '^0[0-9]{8,9}$' then
    raise exception 'INVALID_PHONE';
  end if;

  email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if email is not null
    and (length(email) > 254 or email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'INVALID_EMAIL';
  end if;

  note := nullif(btrim(coalesce(p_note, '')), '');
  if note is not null and length(note) > 500 then
    raise exception 'INVALID_NOTE';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 預約時段檢查（建立與修改預約共用）
--   p_is_admin = true 時允許過去日期與超過可預約天數（後台補登用），
--   其餘檢查（場地、休館、營業時間、時段單位、關閉時段、撞場）一律執行。
--
-- 注意：這裡的撞場檢查只是為了提早回傳友善的錯誤；
--       真正保證不撞場的是 bookings_no_overlap 排除約束。
-- ---------------------------------------------------------------------
create or replace function public.assert_booking_slot(
  p_court_id uuid,
  p_date date,
  p_start time,
  p_end time,
  p_exclude_booking_id uuid,
  p_is_admin boolean
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_court public.courts%rowtype;
  v_hours public.business_hours%rowtype;
  v_slot integer := public.get_setting_int('slot_duration_minutes', 60);
  v_max_days integer := public.get_setting_int('booking_max_days_ahead', 30);
  v_today date := public.taipei_today();
begin
  if p_court_id is null or p_date is null or p_start is null or p_end is null then
    raise exception 'INVALID_INPUT';
  end if;

  if p_end <= p_start then
    raise exception 'INVALID_TIME';
  end if;

  -- 場地存在且啟用
  select * into v_court from public.courts c where c.id = p_court_id;
  if not found then
    raise exception 'COURT_NOT_FOUND';
  end if;
  if v_court.status <> 'active' then
    raise exception 'COURT_UNAVAILABLE';
  end if;

  -- 日期合法（球友端）
  if not p_is_admin then
    if p_date < v_today or (p_date + p_start) <= public.taipei_now() then
      raise exception 'DATE_IN_PAST';
    end if;
    if p_date > v_today + v_max_days then
      raise exception 'DATE_TOO_FAR';
    end if;
  end if;

  -- 休館日
  if exists (
    select 1 from public.holidays h where h.holiday_date = p_date and h.is_closed
  ) then
    raise exception 'FACILITY_CLOSED';
  end if;

  -- 營業時間
  select * into v_hours
  from public.business_hours bh
  where bh.day_of_week = extract(dow from p_date)::integer;
  if not found or not v_hours.is_open then
    raise exception 'FACILITY_CLOSED';
  end if;
  if p_start < v_hours.open_time or p_end > v_hours.close_time then
    raise exception 'OUTSIDE_BUSINESS_HOURS';
  end if;

  -- 時段必須對齊租借單位（第一版為 60 分鐘）
  if (public.time_to_minutes(p_start) - public.time_to_minutes(v_hours.open_time)) % v_slot <> 0
    or (public.time_to_minutes(p_end) - public.time_to_minutes(p_start)) % v_slot <> 0 then
    raise exception 'INVALID_TIME';
  end if;
  -- 球友端一次預約一個時段
  if not p_is_admin
    and public.time_to_minutes(p_end) - public.time_to_minutes(p_start) <> v_slot then
    raise exception 'INVALID_TIME';
  end if;

  -- 關閉時段（整館或指定場地；整天或指定時間）
  if exists (
    select 1 from public.blocked_slots bs
    where bs.blocked_date = p_date
      and (bs.court_id is null or bs.court_id = p_court_id)
      and (bs.start_time is null or (bs.start_time < p_end and bs.end_time > p_start))
  ) then
    raise exception 'SLOT_BLOCKED';
  end if;

  -- 撞場（友善檢查；最終由排除約束保證）
  if exists (
    select 1 from public.bookings b
    where b.court_id = p_court_id
      and b.booking_date = p_date
      and b.status <> 'cancelled'
      and b.start_time < p_end
      and b.end_time > p_start
      and b.id is distinct from p_exclude_booking_id
  ) then
    raise exception 'BOOKING_CONFLICT';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 預約編號：JF + 建立日期(YYYYMMDD) + 4 位流水號，例如 JF202610150001
-- 流水號以單一 UPSERT 原子遞增，並由 bookings.booking_number UNIQUE 再次保證唯一。
-- ---------------------------------------------------------------------
create or replace function public.next_booking_number()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_day date := public.taipei_today();
  v_seq integer;
begin
  insert into public.booking_number_counters as c (counter_date, last_value)
  values (v_day, 1)
  on conflict (counter_date) do update set last_value = c.last_value + 1
  returning c.last_value into v_seq;

  return 'JF' || to_char(v_day, 'YYYYMMDD')
    || lpad(v_seq::text, greatest(4, length(v_seq::text)), '0');
end;
$$;

-- =====================================================================
-- 公開查詢（訪客可呼叫；不回傳任何顧客個資）
-- =====================================================================

-- 月曆：每一天是否可預約
--   open        可預約
--   closed      休館（休館日或當天不營業）
--   past        已過去
--   unavailable 超過可預約天數
create or replace function public.get_date_statuses(p_from date, p_to date)
returns table (
  date date,
  status text,
  holiday_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := public.taipei_today();
  v_max_days integer := public.get_setting_int('booking_max_days_ahead', 30);
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'INVALID_INPUT';
  end if;

  return query
  select
    d::date,
    case
      when d::date < v_today then 'past'
      when h.is_closed then 'closed'
      when bh.id is null or not bh.is_open then 'closed'
      when d::date > v_today + v_max_days then 'unavailable'
      else 'open'
    end,
    h.name
  from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d
  left join public.holidays h on h.holiday_date = d::date
  left join public.business_hours bh on bh.day_of_week = extract(dow from d)::integer
  order by d;
end;
$$;

-- 單日場地狀態：每個場地 × 每個時段
--   available 可預約
--   booked    已預約
--   blocked   不可預約（場地停用、關閉時段、超過可預約天數、無價格）
--   past      時段已開始或已過（前端顯示為不可預約）
--   closed    休館
create or replace function public.get_day_availability(p_date date)
returns table (
  court_id uuid,
  court_name text,
  sort_order integer,
  start_time time,
  end_time time,
  status text,
  price integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_hours public.business_hours%rowtype;
  v_slot integer := public.get_setting_int('slot_duration_minutes', 60);
  v_max_days integer := public.get_setting_int('booking_max_days_ahead', 30);
  v_today date := public.taipei_today();
  v_now timestamp := public.taipei_now();
  v_closed boolean;
begin
  if p_date is null then
    raise exception 'INVALID_INPUT';
  end if;

  select * into v_hours
  from public.business_hours bh
  where bh.day_of_week = extract(dow from p_date)::integer;

  -- 當天不營業：沒有任何時段
  if not found or not v_hours.is_open then
    return;
  end if;

  v_closed := exists (
    select 1 from public.holidays h where h.holiday_date = p_date and h.is_closed
  );

  return query
  with slots as (
    select
      public.minutes_to_time(m) as slot_start,
      public.minutes_to_time(m + v_slot) as slot_end
    from generate_series(
      public.time_to_minutes(v_hours.open_time),
      public.time_to_minutes(v_hours.close_time) - v_slot,
      v_slot
    ) as m
  ),
  priced as (
    select s.slot_start, s.slot_end, public.calculate_price(p_date, s.slot_start, s.slot_end) as slot_price
    from slots s
  )
  select
    c.id,
    c.name,
    c.sort_order,
    p.slot_start,
    p.slot_end,
    case
      when v_closed then 'closed'
      when p_date < v_today or (p_date + p.slot_start) <= v_now then 'past'
      when exists (
        select 1 from public.bookings b
        where b.court_id = c.id
          and b.booking_date = p_date
          and b.status <> 'cancelled'
          and b.start_time < p.slot_end
          and b.end_time > p.slot_start
      ) then 'booked'
      when c.status <> 'active' then 'blocked'
      when p_date > v_today + v_max_days then 'blocked'
      when exists (
        select 1 from public.blocked_slots bs
        where bs.blocked_date = p_date
          and (bs.court_id is null or bs.court_id = c.id)
          and (bs.start_time is null or (bs.start_time < p.slot_end and bs.end_time > p.slot_start))
      ) then 'blocked'
      when p.slot_price is null then 'blocked'
      else 'available'
    end,
    p.slot_price
  from public.courts c
  cross join priced p
  order by p.slot_start, c.sort_order, c.name;
end;
$$;

-- =====================================================================
-- 球友端（僅限 server 以 secret key 呼叫，見檔案最後的權限設定）
-- =====================================================================

-- 建立預約：價格由資料庫計算，狀態固定為 confirmed
create or replace function public.create_booking(
  p_court_id uuid,
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_note text default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_customer record;
  v_price integer;
  v_booking public.bookings;
begin
  select * into v_customer
  from public.normalize_customer(p_customer_name, p_customer_phone, p_customer_email, p_note, true);

  perform public.assert_booking_slot(p_court_id, p_booking_date, p_start_time, p_end_time, null, false);

  v_price := public.calculate_price(p_booking_date, p_start_time, p_end_time);
  if v_price is null then
    raise exception 'PRICE_NOT_FOUND';
  end if;

  begin
    insert into public.bookings (
      booking_number, court_id, booking_date, start_time, end_time,
      customer_name, customer_phone, customer_email, price, status, note, source
    ) values (
      public.next_booking_number(), p_court_id, p_booking_date, p_start_time, p_end_time,
      v_customer.name, v_customer.phone, v_customer.email, v_price, 'confirmed', v_customer.note, 'customer'
    )
    returning * into v_booking;
  exception
    -- 兩人同時預約同一場地同一時段：後送出的一方在這裡被排除約束擋下
    when exclusion_violation then
      raise exception 'BOOKING_CONFLICT';
  end;

  return v_booking;
end;
$$;

-- 查詢預約：必須同時提供預約編號與手機
create or replace function public.get_customer_booking(p_booking_number text, p_phone text)
returns table (
  booking_number text,
  court_name text,
  booking_date date,
  start_time time,
  end_time time,
  price integer,
  status text,
  customer_name text,
  customer_phone text,
  can_cancel boolean,
  cancel_deadline timestamp
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g');
  v_number text := upper(btrim(coalesce(p_booking_number, '')));
  v_deadline_hours integer := public.get_setting_int('cancellation_deadline_hours', 2);
begin
  return query
  select
    b.booking_number,
    c.name,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.price,
    case
      when b.status = 'confirmed' and (b.booking_date + b.end_time) <= public.taipei_now() then 'completed'
      else b.status
    end,
    b.customer_name,
    b.customer_phone,
    b.status in ('pending', 'confirmed')
      and public.taipei_now() < (b.booking_date + b.start_time) - make_interval(hours => v_deadline_hours),
    (b.booking_date + b.start_time) - make_interval(hours => v_deadline_hours)
  from public.bookings b
  join public.courts c on c.id = b.court_id
  where b.booking_number = v_number
    and b.customer_phone = v_phone;
end;
$$;

-- 球友取消預約：開始前 cancellation_deadline_hours 小時以前才可取消
create or replace function public.cancel_customer_booking(p_booking_number text, p_phone text)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g');
  v_number text := upper(btrim(coalesce(p_booking_number, '')));
  v_deadline_hours integer := public.get_setting_int('cancellation_deadline_hours', 2);
  v_booking public.bookings;
begin
  -- 鎖定該筆預約，避免同時重複取消
  select * into v_booking
  from public.bookings b
  where b.booking_number = v_number and b.customer_phone = v_phone
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if v_booking.status = 'cancelled' then
    raise exception 'ALREADY_CANCELLED';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'CANCEL_NOT_ALLOWED';
  end if;
  if public.taipei_now() >= (v_booking.booking_date + v_booking.start_time)
      - make_interval(hours => v_deadline_hours) then
    raise exception 'CANCEL_DEADLINE_PASSED';
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_at = now()
  where id = v_booking.id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- 已結束的 confirmed 預約標記為 completed
create or replace function public.complete_finished_bookings()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.bookings
  set status = 'completed'
  where status = 'confirmed'
    and (booking_date + end_time) <= public.taipei_now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =====================================================================
-- 後台（登入者必須是 profiles 中的 admin / staff）
-- =====================================================================

create or replace function public.admin_create_booking(
  p_court_id uuid,
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_note text default null,
  p_price integer default null,
  p_status text default 'confirmed'
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_customer record;
  v_price integer;
  v_booking public.bookings;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;

  if p_status is null or p_status not in ('pending', 'confirmed', 'completed') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into v_customer
  from public.normalize_customer(p_customer_name, p_customer_phone, p_customer_email, p_note, false);

  perform public.assert_booking_slot(p_court_id, p_booking_date, p_start_time, p_end_time, null, true);

  -- 管理員可自訂費用；未填則由規則計算
  v_price := coalesce(p_price, public.calculate_price(p_booking_date, p_start_time, p_end_time));
  if v_price is null then
    raise exception 'PRICE_NOT_FOUND';
  end if;
  if v_price < 0 then
    raise exception 'INVALID_PRICE';
  end if;

  begin
    insert into public.bookings (
      booking_number, court_id, booking_date, start_time, end_time,
      customer_name, customer_phone, customer_email, price, status, note, source
    ) values (
      public.next_booking_number(), p_court_id, p_booking_date, p_start_time, p_end_time,
      v_customer.name, v_customer.phone, v_customer.email, v_price, p_status, v_customer.note, 'admin'
    )
    returning * into v_booking;
  exception
    when exclusion_violation then
      raise exception 'BOOKING_CONFLICT';
  end;

  return v_booking;
end;
$$;

create or replace function public.admin_update_booking(
  p_booking_id uuid,
  p_court_id uuid,
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_note text,
  p_price integer,
  p_status text
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.bookings;
  v_customer record;
  v_price integer;
  v_booking public.bookings;
  v_schedule_changed boolean;
  v_reactivated boolean;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;

  if p_status is null or p_status not in ('pending', 'confirmed', 'cancelled', 'completed') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into v_old from public.bookings b where b.id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  select * into v_customer
  from public.normalize_customer(p_customer_name, p_customer_phone, p_customer_email, p_note, false);

  v_schedule_changed := p_court_id is distinct from v_old.court_id
    or p_booking_date is distinct from v_old.booking_date
    or p_start_time is distinct from v_old.start_time
    or p_end_time is distinct from v_old.end_time;
  v_reactivated := v_old.status = 'cancelled' and p_status <> 'cancelled';

  -- 修改日期／時間／場地，或把已取消的預約恢復時，必須重新檢查
  if p_status <> 'cancelled' and (v_schedule_changed or v_reactivated) then
    perform public.assert_booking_slot(
      p_court_id, p_booking_date, p_start_time, p_end_time, p_booking_id, true
    );
  end if;

  v_price := coalesce(p_price, public.calculate_price(p_booking_date, p_start_time, p_end_time));
  if v_price is null then
    raise exception 'PRICE_NOT_FOUND';
  end if;
  if v_price < 0 then
    raise exception 'INVALID_PRICE';
  end if;

  begin
    update public.bookings
    set court_id = p_court_id,
        booking_date = p_booking_date,
        start_time = p_start_time,
        end_time = p_end_time,
        customer_name = v_customer.name,
        customer_phone = v_customer.phone,
        customer_email = v_customer.email,
        note = v_customer.note,
        price = v_price,
        status = p_status,
        cancelled_at = case
          when p_status = 'cancelled' then coalesce(v_old.cancelled_at, now())
          else null
        end
    where id = p_booking_id
    returning * into v_booking;
  exception
    when exclusion_violation then
      raise exception 'BOOKING_CONFLICT';
  end;

  return v_booking;
end;
$$;

create or replace function public.admin_cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN';
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_at = now()
  where id = p_booking_id and status <> 'cancelled'
  returning * into v_booking;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  return v_booking;
end;
$$;

-- =====================================================================
-- 函式執行權限
-- PostgreSQL 預設會把 EXECUTE 授權給 PUBLIC，Supabase 也會自動授權給
-- anon / authenticated，因此這裡先全部收回，再逐一開放。
-- =====================================================================
revoke execute on all functions in schema public from public, anon, authenticated;

-- 訪客可用：只回傳可預約狀態與價格，不含任何顧客資料
grant execute on function public.get_date_statuses(date, date) to anon, authenticated;
grant execute on function public.get_day_availability(date) to anon, authenticated;
grant execute on function public.calculate_price(date, time, time) to anon, authenticated;

-- RLS policy 會用到
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- 後台：函式內再檢查 is_staff()
grant execute on function public.admin_create_booking(uuid, date, time, time, text, text, text, text, integer, text) to authenticated;
grant execute on function public.admin_update_booking(uuid, uuid, date, time, time, text, text, text, text, integer, text) to authenticated;
grant execute on function public.admin_cancel_booking(uuid) to authenticated;

-- 球友端建立／查詢／取消預約：只允許 server（secret key = service_role）呼叫
grant execute on function public.create_booking(uuid, date, time, time, text, text, text, text) to service_role;
grant execute on function public.get_customer_booking(text, text) to service_role;
grant execute on function public.cancel_customer_booking(text, text) to service_role;
grant execute on function public.complete_finished_bookings() to service_role;
