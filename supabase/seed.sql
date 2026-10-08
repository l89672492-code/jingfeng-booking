-- =====================================================================
-- 勁丰羽球館｜場地預約系統 — 初始資料
-- 可重複執行：已存在的資料不會被覆蓋。
-- 這些是系統運作所需的正式基礎設定（場地、價格、營業時間、系統設定），
-- 不包含任何預約或顧客資料。
-- =====================================================================

-- 場地 A–E
insert into public.courts (name, status, sort_order) values
  ('A場', 'active', 1),
  ('B場', 'active', 2),
  ('C場', 'active', 3),
  ('D場', 'active', 4),
  ('E場', 'active', 5)
on conflict (name) do nothing;

-- 營業時間：每天 09:00–22:00（0 = 星期日 … 6 = 星期六）
insert into public.business_hours (day_of_week, open_time, close_time, is_open) values
  (0, '09:00', '22:00', true),
  (1, '09:00', '22:00', true),
  (2, '09:00', '22:00', true),
  (3, '09:00', '22:00', true),
  (4, '09:00', '22:00', true),
  (5, '09:00', '22:00', true),
  (6, '09:00', '22:00', true)
on conflict (day_of_week) do nothing;

-- 價格規則（每小時）：只在尚未有任何價格規則時建立
insert into public.pricing_rules (day_type, start_time, end_time, price)
select v.day_type, v.start_time::time, v.end_time::time, v.price
from (values
  ('weekday', '09:00', '18:00', 350),
  ('weekday', '18:00', '22:00', 500),
  ('holiday', '09:00', '12:00', 500),
  ('holiday', '12:00', '14:00', 350),
  ('holiday', '14:00', '22:00', 500)
) as v (day_type, start_time, end_time, price)
where not exists (select 1 from public.pricing_rules);

-- 系統設定
insert into public.system_settings (key, value, description, is_public) values
  ('cancellation_deadline_hours', '2', '球友可自行取消的期限（開始前幾小時）', true),
  ('booking_max_days_ahead', '30', '最多可預約幾天後的場地', true),
  ('slot_duration_minutes', '60', '租借單位（分鐘）', true),
  ('facility_name', '勁丰羽球館', '場館名稱', true),
  ('facility_phone', '0928-890-559', '場館電話', true),
  ('facility_address', '新北市鶯歌區環河路60-1號', '場館地址', true),
  ('facility_line', '@213nkfpk', '官方 LINE', true)
on conflict (key) do nothing;
