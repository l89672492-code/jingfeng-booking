-- =====================================================================
-- 開始時間改為每 30 分鐘一個選項（例如 19:30–20:30）
--
--   slot_duration_minutes = 60  每次租借長度（不變）
--   slot_step_minutes     = 30  開始時間間隔（新增）
--
-- 價格改以 slot_step_minutes 為單位逐段計算（每小時價格 × 段長 / 60），
-- 因此跨越價格分界的時段會按比例計價，例如平日 17:30–18:30
-- = 350 × 0.5 + 500 × 0.5 = 425 元。
--
-- 防撞場不受影響：bookings_no_overlap 排除約束以實際時間區間判斷重疊，
-- 19:00–20:00 與 19:30–20:30 屬於重疊，不能同時存在。
-- =====================================================================

insert into public.system_settings (key, value, description, is_public) values
  ('slot_step_minutes', '30', '可選擇的開始時間間隔（分鐘）', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 價格計算：以開始時間間隔逐段計價
-- ---------------------------------------------------------------------
create or replace function public.calculate_price(p_date date, p_start time, p_end time)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_step integer := public.get_setting_int('slot_step_minutes', 30);
  v_day_type text;
  v_start integer;
  v_end integer;
  v_minute integer;
  v_rate integer;
  v_total numeric := 0;
begin
  if p_date is null or p_start is null or p_end is null or v_step <= 0 then
    return null;
  end if;

  v_start := public.time_to_minutes(p_start);
  v_end := public.time_to_minutes(p_end);
  if v_end <= v_start or (v_end - v_start) % v_step <> 0 then
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
      and r.end_time >= public.minutes_to_time(v_minute + v_step)
    order by (r.day_type = 'special') desc, r.updated_at desc
    limit 1;

    if not found then
      return null;
    end if;

    -- 價格規則為「每小時價格」
    v_total := v_total + v_rate * v_step / 60.0;
    v_minute := v_minute + v_step;
  end loop;

  return round(v_total)::integer;
end;
$$;

-- ---------------------------------------------------------------------
-- 預約時段檢查：開始時間對齊 slot_step_minutes；球友端長度固定 slot_duration_minutes
-- （其餘檢查與 20261008000002 相同）
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
  v_duration integer := public.get_setting_int('slot_duration_minutes', 60);
  v_step integer := public.get_setting_int('slot_step_minutes', 30);
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

  -- 開始與結束時間必須對齊開始時間間隔（30 分鐘）
  if (public.time_to_minutes(p_start) - public.time_to_minutes(v_hours.open_time)) % v_step <> 0
    or (public.time_to_minutes(p_end) - public.time_to_minutes(p_start)) % v_step <> 0 then
    raise exception 'INVALID_TIME';
  end if;
  -- 球友端一次預約固定長度（1 小時）
  if not p_is_admin
    and public.time_to_minutes(p_end) - public.time_to_minutes(p_start) <> v_duration then
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
-- 單日場地狀態：開始時間每 slot_step_minutes 一個，每個時段長 slot_duration_minutes
-- ---------------------------------------------------------------------
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
  v_duration integer := public.get_setting_int('slot_duration_minutes', 60);
  v_step integer := public.get_setting_int('slot_step_minutes', 30);
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
      public.minutes_to_time(m + v_duration) as slot_end
    from generate_series(
      public.time_to_minutes(v_hours.open_time),
      public.time_to_minutes(v_hours.close_time) - v_duration,
      v_step
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

-- CREATE OR REPLACE 會保留原有權限；這裡再明確設定一次，避免日後誤開放
revoke execute on function public.calculate_price(date, time, time) from public;
revoke execute on function public.assert_booking_slot(uuid, date, time, time, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.get_day_availability(date) from public;
grant execute on function public.calculate_price(date, time, time) to anon, authenticated;
grant execute on function public.get_day_availability(date) to anon, authenticated;
