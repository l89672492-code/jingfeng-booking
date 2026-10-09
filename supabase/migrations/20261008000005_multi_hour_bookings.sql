-- =====================================================================
-- 球友可一次租用多個小時（例如 2 小時、2.5 小時）
--
--   slot_duration_minutes = 60   最短租用時間（不變）
--   slot_step_minutes     = 30   開始時間與租用時數的間隔（不變）
--   booking_max_minutes   = 240  球友一次最長可租用的時間（新增，可在 system_settings 修改）
--
-- 球友可選：60、90、120 … 240 分鐘。
-- 價格依實際租用時段逐段計算（calculate_price 不變），例如平日
-- 17:00–19:00 = 350 + 500 = 850 元。
-- 防撞場不受影響：排除約束以實際時間區間判斷重疊。
-- =====================================================================

insert into public.system_settings (key, value, description, is_public) values
  ('booking_max_minutes', '240', '球友一次最長可租用的時間（分鐘）', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 預約時段檢查：球友端租用時間介於最短與最長之間，且為 30 分鐘的倍數
-- （其餘檢查與 20261008000004 相同）
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
  v_max_minutes integer := public.get_setting_int('booking_max_minutes', 240);
  v_length integer;
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
  -- 球友端租用時間：最短 slot_duration_minutes，最長 booking_max_minutes
  v_length := public.time_to_minutes(p_end) - public.time_to_minutes(p_start);
  if not p_is_admin and (v_length < v_duration or v_length > v_max_minutes) then
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
-- 單日場地狀態：可指定租用時間（分鐘），每個開始時間回傳該長度的時段狀態
-- 原本只有 p_date 一個參數；改為兩個參數（第二個有預設值）。
-- 先刪除舊版本，避免兩個版本同時存在造成呼叫時無法判斷。
-- ---------------------------------------------------------------------
drop function if exists public.get_day_availability(date);

create or replace function public.get_day_availability(p_date date, p_duration_minutes integer default null)
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
  v_min_minutes integer := public.get_setting_int('slot_duration_minutes', 60);
  v_max_minutes integer := public.get_setting_int('booking_max_minutes', 240);
  v_duration integer;
  v_step integer := public.get_setting_int('slot_step_minutes', 30);
  v_max_days integer := public.get_setting_int('booking_max_days_ahead', 30);
  v_today date := public.taipei_today();
  v_now timestamp := public.taipei_now();
  v_closed boolean;
begin
  v_duration := coalesce(p_duration_minutes, v_min_minutes);
  if p_date is null or v_duration < v_min_minutes or v_duration > v_max_minutes
    or v_duration % v_step <> 0 then
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

revoke execute on function public.get_day_availability(date, integer) from public;
grant execute on function public.get_day_availability(date, integer) to anon, authenticated;
revoke execute on function public.assert_booking_slot(uuid, date, time, time, uuid, boolean) from public, anon, authenticated;
