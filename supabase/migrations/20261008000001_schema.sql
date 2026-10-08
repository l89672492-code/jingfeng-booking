-- =====================================================================
-- 勁丰羽球館｜場地預約系統 — 資料表結構
--
-- 時區：所有「日期／時間」欄位皆代表台灣當地時間（Asia/Taipei）。
-- 星期：day_of_week 使用 0=星期日 … 6=星期六（與 PostgreSQL extract(dow) 相同）。
-- =====================================================================

-- btree_gist：讓 uuid 等純量型別可以和 range 型別一起放進 GiST 排除約束（防撞場核心）
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- 共用：自動更新 updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles：後台人員（對應 auth.users）。一般球友不需要帳號，不會出現在這裡。
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  role text not null check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is '後台人員資料；role = admin（管理員）或 staff（員工）';

-- ---------------------------------------------------------------------
-- courts：場地
-- ---------------------------------------------------------------------
create table public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 20),
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on column public.courts.status is 'active = 開放預約；inactive = 停用（例如維修）';

-- ---------------------------------------------------------------------
-- business_hours：每週營業時間（每個星期一筆）
-- ---------------------------------------------------------------------
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null unique check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  is_open boolean not null default true,
  check (close_time > open_time)
);

-- ---------------------------------------------------------------------
-- holidays：特殊日期（國定假日、休館日）
--   is_closed = true  → 全館休館
--   day_type          → 未休館時，該日以「平日」或「假日」計價（null 則依星期判斷）
-- ---------------------------------------------------------------------
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null check (length(btrim(name)) between 1 and 50),
  is_closed boolean not null default false,
  day_type text check (day_type in ('weekday', 'holiday')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- pricing_rules：價格規則（每小時價格）
--   day_type = weekday  平日
--   day_type = holiday  假日
--   day_type = special  特殊日期（需填 special_date，優先權最高）
-- 價格優先順序：特殊日期 > 假日 > 平日
-- ---------------------------------------------------------------------
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  day_type text not null check (day_type in ('weekday', 'holiday', 'special')),
  special_date date,
  start_time time not null,
  end_time time not null,
  price integer not null check (price >= 0),
  member_price integer check (member_price >= 0), -- 第二階段會員價預留，目前不使用
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check ((day_type = 'special') = (special_date is not null))
);

comment on column public.pricing_rules.price is '每小時價格（新台幣元）';

create index pricing_rules_lookup_idx
  on public.pricing_rules (day_type, special_date)
  where active;

create trigger pricing_rules_set_updated_at
  before update on public.pricing_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- blocked_slots：關閉時段
--   court_id 為 null              → 整個場館
--   start_time / end_time 為 null → 整天
-- ---------------------------------------------------------------------
create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  court_id uuid references public.courts (id) on delete cascade,
  blocked_date date not null,
  start_time time,
  end_time time,
  reason text not null default '' check (length(reason) <= 100),
  created_at timestamptz not null default now(),
  check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time)
  )
);

create index blocked_slots_date_idx on public.blocked_slots (blocked_date);

-- ---------------------------------------------------------------------
-- system_settings：系統設定（key / value）
--   is_public = true 的設定可被一般訪客讀取（例如場館電話）
-- ---------------------------------------------------------------------
create table public.system_settings (
  key text primary key,
  value text not null,
  description text not null default '',
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger system_settings_set_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- bookings：預約
-- ---------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique check (booking_number ~ '^JF[0-9]{12,}$'),
  court_id uuid not null references public.courts (id) on delete restrict,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  customer_name text not null check (length(btrim(customer_name)) between 1 and 50),
  -- 已正規化為純數字；球友端限台灣手機 09xxxxxxxx，後台可輸入市話
  customer_phone text not null check (customer_phone ~ '^0[0-9]{8,9}$'),
  customer_email text check (customer_email is null or length(customer_email) <= 254),
  price integer not null check (price >= 0),
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  note text check (note is null or length(note) <= 500),
  source text not null default 'customer' check (source in ('customer', 'admin')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),

  -- ===================================================================
  -- 防撞場（最重要）
  --
  -- 使用 PostgreSQL「排除約束」(EXCLUDE USING gist)：
  --   同一個 court_id，且時間區間 [日期+開始, 日期+結束) 互相重疊（&&）的
  --   「有效」預約（status 不是 cancelled），資料庫最多只允許存在一筆。
  --
  -- 為什麼選這個方法：
  --   * 由資料庫在寫入當下強制檢查，與應用程式邏輯無關；即使兩個請求
  --     在同一毫秒送出，第二筆 INSERT/UPDATE 也會因 exclusion_violation
  --     (SQLSTATE 23P01) 失敗，不可能同時存在兩筆重疊的有效預約。
  --   * 不需要應用程式自行加鎖，也不會因為忘記加鎖而出錯。
  --   * 使用半開區間 '[)'，所以 19:00–20:00 與 20:00–21:00 不算重疊。
  --   * 取消（cancelled）的預約不受約束，場地會自動釋放。
  -- ===================================================================
  constraint bookings_no_overlap exclude using gist (
    court_id with =,
    tsrange(booking_date + start_time, booking_date + end_time, '[)') with &&
  ) where (status <> 'cancelled')
);

create index bookings_date_idx on public.bookings (booking_date, start_time);
create index bookings_phone_idx on public.bookings (customer_phone);
create index bookings_status_idx on public.bookings (status);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- booking_number_counters：預約編號流水號（每天一列）
-- 以 INSERT ... ON CONFLICT DO UPDATE 原子遞增，同時建立多筆也不會重號；
-- 若預約建立失敗，整個交易回滾，流水號也一併回滾。
-- ---------------------------------------------------------------------
create table public.booking_number_counters (
  counter_date date primary key,
  last_value integer not null
);
