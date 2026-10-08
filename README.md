# 勁丰羽球館｜場地預約系統

勁丰羽球館（新北市鶯歌區環河路60-1號）的線上場地租借預約系統。

- **球友**：不需註冊，線上查看空檔 → 選日期、時間、場地 → 完成預約；可用「預約編號＋手機」查詢與取消。
- **管理員**：登入後台管理所有預約、價格、營業時間、場地、關閉時段與休館日。

第一版只做「場地租借預約」。會員、付款、零打、教學、LINE 通知等留待第二階段。

---

## 目錄

1. [技術架構](#技術架構)
2. [資料夾結構](#資料夾結構)
3. [環境變數](#環境變數)
4. [Supabase 設定](#supabase-設定)
5. [Database migration 與 Seed data](#database-migration-與-seed-data)
6. [建立管理員帳號](#建立管理員帳號)
7. [本機啟動](#本機啟動)
8. [測試](#測試)
9. [GitHub 設定](#github-設定)
10. [Vercel 部署](#vercel-部署)
11. [防撞場與安全設計](#防撞場與安全設計)
12. [常見問題](#常見問題)

---

## 技術架構

| 項目 | 技術 |
| --- | --- |
| 前端／後端 | Next.js 16（App Router、Server Components、Server Actions、Cache Components） |
| 語言 | TypeScript |
| 樣式 | Tailwind CSS v4（手機優先） |
| 資料庫 | Supabase PostgreSQL（migration 管理、RLS、資料庫函式） |
| 登入 | Supabase Auth（僅後台人員） |
| 表單驗證 | zod（前端提示 + server 再驗證 + 資料庫第三次驗證） |
| 測試 | Vitest + PGlite（在 Node 內執行真正的 PostgreSQL 跑 migration） |
| 部署 | Vercel |

### 頁面

| 路徑 | 說明 |
| --- | --- |
| `/` | 首頁 |
| `/booking` | 租場預約（6 步驟） |
| `/booking/success` | 預約成功 |
| `/my-booking` | 查詢／取消我的預約 |
| `/login` | 管理員登入 |
| `/admin` | 後台首頁（今日／本週／本月統計、目前場地狀況） |
| `/admin/calendar` | 場地表（一次顯示 5 面場）＋月曆 |
| `/admin/bookings` | 預約列表（篩選、搜尋） |
| `/admin/bookings/new` | 新增預約 |
| `/admin/bookings/[id]` | 預約詳細資料、修改、取消 |
| `/admin/pricing` | 價格管理 |
| `/admin/courts` | 場地管理 |
| `/admin/blocked` | 關閉時段 |
| `/admin/holidays` | 休館日／特殊日期 |
| `/admin/business-hours` | 營業時間 |
| `/admin/settings` | 系統設定（取消期限、可預約天數、場館資訊） |

---

## 資料夾結構

```
jingfeng-booking/
├─ src/
│  ├─ app/
│  │  ├─ (public)/            球友端頁面（首頁、預約、查詢）
│  │  ├─ admin/               後台頁面與 Server Actions
│  │  ├─ login/               管理員登入
│  │  └─ api/availability/    可預約狀態查詢 API（僅公開資訊）
│  ├─ components/             共用元件
│  ├─ lib/
│  │  ├─ booking/             日期、驗證、錯誤訊息、狀態整理（前後端共用）
│  │  └─ supabase/            Supabase client
│  │     ├─ client.ts         瀏覽器端（publishable key）
│  │     ├─ server.ts         伺服器端，帶登入者 cookie（publishable key）
│  │     ├─ public.ts         伺服器端，訪客權限（publishable key）
│  │     ├─ admin.ts          伺服器端，secret key（僅 server-only）
│  │     └─ proxy.ts          更新登入 session
│  ├─ server/                 server-only 資料存取層
│  │  ├─ availability.ts      getAvailableTimeSlots / getAvailableCourts / calculateBookingPrice …
│  │  ├─ bookings.ts          createBooking / getBookingByNumber / cancelBooking
│  │  ├─ auth.ts              requireStaff / requireAdmin
│  │  └─ admin/               getBookings / createAdminBooking / updateBooking /
│  │                          getPricingRules / updatePricingRule / createBlockedSlot …
│  ├─ types/database.ts       資料庫型別
│  └─ proxy.ts                後台路由第一道檢查
├─ supabase/
│  ├─ migrations/             資料庫 migration（資料表、約束、函式、RLS）
│  ├─ seed.sql                初始資料（A–E 場、價格、營業時間、系統設定）
│  └─ config.toml             Supabase CLI 設定
├─ tests/
│  ├─ db/                     資料庫測試（防撞場、價格、權限、RLS）
│  └─ app/                    應用程式測試（驗證、後台保護、金鑰邊界）
└─ scripts/check-client-bundle.mjs   檢查瀏覽器程式碼沒有 secret key
```

---

## 環境變數

複製範本：

```bash
cp .env.example .env.local
```

（Windows PowerShell：`Copy-Item .env.example .env.local`）

| 變數 | 說明 | 會送到瀏覽器？ |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案網址，例如 `https://xxxx.supabase.co`（**不要**加 `/rest/v1/`） | 會 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key（`sb_publishable_...`） | 會（本來就是公開金鑰） |
| `SUPABASE_SECRET_KEY` | Secret key（`sb_secret_...`），會略過 RLS | **絕對不會** |

- 也支援舊版名稱：`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`（二擇一即可）。
- Secret key **絕對不可**加上 `NEXT_PUBLIC_` 前綴。
- `.env.local` 已被 `.gitignore` 排除，不會進入 Git。
- 金鑰位置：Supabase 後台 → **Project Settings → API Keys**。

---

## Supabase 設定

### 1. 關閉公開註冊（重要）

後台帳號由管理員手動建立，球友不需要帳號。請關閉自行註冊：

Supabase 後台 → **Authentication → Sign In / Providers** → 關閉 **Allow new users to sign up**。

（即使沒關，未被加入 `profiles` 的帳號也無法讀取任何預約資料，但關閉可減少風險。）

### 2. 執行 migration 與 seed

見下一節。

---

## Database migration 與 Seed data

所有資料庫結構都在 `supabase/migrations/`，**請勿在 Supabase 後台手動修改資料表**。

| 檔案 | 內容 |
| --- | --- |
| `20261008000001_schema.sql` | 資料表、CHECK 約束、索引、**防撞場排除約束**、trigger |
| `20261008000002_booking_functions.sql` | 可預約查詢、價格計算、建立／查詢／取消預約、後台預約函式、函式權限 |
| `20261008000003_rls.sql` | Row Level Security 與資料表權限 |
| `seed.sql` | A–E 場、目前價格、營業時間 09:00–22:00、系統設定（可重複執行，不會覆蓋） |

### 方法 A：Supabase CLI（建議）

專案已內建 Supabase CLI（`npx supabase`）。

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <你的 project id>
```

（project id 是網址 `https://<project id>.supabase.co` 中的那一段；過程中會要求輸入資料庫密碼，可在 Project Settings → Database 重設。）

```bash
npm run db:push
```

`db:push` = `supabase db push --include-seed`，會依序執行尚未執行過的 migration，並寫入 seed。

### 方法 B：SQL Editor

Supabase 後台 → **SQL Editor**，依序貼上並執行：

1. `supabase/migrations/20261008000001_schema.sql`
2. `supabase/migrations/20261008000002_booking_functions.sql`
3. `supabase/migrations/20261008000003_rls.sql`
4. `supabase/seed.sql`

> 方法 B 不會記錄 migration 歷史；之後若改用 CLI，需先執行 `npx supabase migration repair` 標記已執行的版本。

### 之後修改資料庫

新增一個 migration 檔（不要修改已執行過的檔案）：

```bash
npx supabase migration new <名稱>
```

新增函式時，請記得在同一個 migration 中 `revoke execute ... from public, anon, authenticated` 再依需要 `grant`（Supabase 預設會開放給所有角色）。

---

## 建立管理員帳號

1. Supabase 後台 → **Authentication → Users → Add user → Create new user**
   - 輸入 Email、密碼，勾選 **Auto Confirm User**。
2. 建立後點該使用者，複製 **User UID**。
3. Supabase 後台 → **SQL Editor** 執行（把 UID 換成剛才複製的值）：

```sql
insert into public.profiles (id, name, role)
values ('貼上 User UID', '管理員', 'admin');
```

`role` 可用：

- `admin`：全部功能
- `staff`：預約管理、場地表、關閉時段（不能改價格、場地、營業時間、休館日、系統設定）

4. 到 `/login` 用該 Email 與密碼登入。

移除後台權限：`delete from public.profiles where id = '...';`

---

## 本機啟動

需要 Node.js 20.9 以上（建議 LTS）。

```bash
npm install
```

```bash
npm run dev
```

開啟 http://localhost:3000

其他指令：

| 指令 | 說明 |
| --- | --- |
| `npm run lint` | ESLint 檢查 |
| `npm run build` | 建置正式版本 |
| `npm run start` | 啟動正式版本（需先 build） |
| `npm test` | 執行所有測試 |
| `npm run check:bundle` | build 後檢查瀏覽器程式碼沒有 secret key |
| `npm run db:push` | 把 migration 與 seed 推到已 link 的 Supabase |

---

## 測試

```bash
npm test
```

測試不需要網路或 Supabase 帳號：`tests/db` 會用 PGlite 在記憶體中建立 PostgreSQL，模擬 Supabase 的 `anon`／`authenticated`／`service_role` 角色，實際執行 `supabase/migrations` 與 `seed.sql`。

涵蓋：

1. 正常預約成功（預約編號、價格、狀態）
2. 相同場地相同時間不能重複預約（含略過應用程式直接寫入，仍被排除約束擋下）
3. 不同場地同時間可以預約
4. 不同日期可以預約
5. 已取消預約後可以重新租
6. 過去日期不能預約
7. 休館日不能預約
8. 停用場地、關閉時段不能預約
9. 非營業時間不能預約
10. 前端竄改價格不能成功
11. 未登入不能進入管理後台；非後台人員讀不到預約、不能改價格
12. 管理員修改場地後會重新檢查撞場

另外還有價格規則（平日／假日／特殊日期／停用）、取消期限、查詢預約、表單驗證、金鑰不外洩等測試。

---

## GitHub 設定

```bash
git remote add origin https://github.com/<帳號>/jingfeng-booking.git
```

```bash
git push -u origin main
```

`.env.local` 不會被提交。請勿把任何金鑰寫進程式碼或 commit。

---

## Vercel 部署

1. 登入 https://vercel.com → **Add New… → Project** → 匯入 GitHub 的 `jingfeng-booking`。
2. Framework Preset 會自動偵測為 **Next.js**，Build／Output 設定不用改。
3. **Environment Variables** 加入（Production、Preview 都要勾）：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
4. 按 **Deploy**。
5. 之後 push 到 `main` 會自動部署。

> 修改環境變數後需要重新部署（Deployments → 最新一筆 → Redeploy）才會生效，因為 `NEXT_PUBLIC_*` 是在 build 時寫入的。

---

## 防撞場與安全設計

### 防撞場（資料庫層級）

`bookings` 資料表有 PostgreSQL **排除約束**：

```sql
constraint bookings_no_overlap exclude using gist (
  court_id with =,
  tsrange(booking_date + start_time, booking_date + end_time, '[)') with &&
) where (status <> 'cancelled')
```

- 同一場地、時間重疊的「有效」預約，資料庫最多只允許一筆。
- 兩人同時送出時，後寫入的一方會收到 `exclusion_violation`，系統顯示「這個場地剛剛已被其他球友預約，請重新選擇。」
- 取消的預約不受約束，場地自動釋放；19:00–20:00 與 20:00–21:00 不算重疊。
- 管理員新增、修改、恢復預約也一樣受這個約束保護。

### 價格

- 球友端建立預約的資料庫函式 `create_booking()` **沒有價格參數**，價格一律由 `calculate_price()` 依 `pricing_rules` 計算。
- 前端多傳的 `price` 會被 zod 丟棄；即使直接呼叫 API 也無法指定價格。
- 優先順序：特殊日期 > 假日（週六日、或休館日設定為假日） > 平日。

### 權限

- 訪客（publishable key）只能讀取場地、價格、營業時間等公開資訊，**讀不到任何預約與個資**，也不能寫入任何資料表。
- 球友建立／查詢／取消預約的函式只開放給 `service_role`，由 Next.js server 以 secret key 呼叫。
- 後台：`proxy.ts` 先擋未登入者 → 每個頁面與 Server Action 呼叫 `requireStaff()`／`requireAdmin()` → 資料庫 RLS 與函式內的 `is_staff()` 再檢查一次。
- `admin.ts`、`server.ts`、`src/server/*` 都有 `server-only`，被前端匯入時 build 會失敗；測試也會檢查。

### 預約狀態

| 狀態 | 說明 |
| --- | --- |
| `pending` | 待確認（後台可手動設定） |
| `confirmed` | 已確認（球友線上預約後的狀態） |
| `cancelled` | 已取消 |
| `completed` | 已完成（時段結束後，開啟後台頁面時自動更新） |

---

## 常見問題

**Q. 首頁顯示「場館資訊暫時無法載入」、預約頁顯示「目前系統暫時無法完成預約」**
A. 通常是 migration 還沒執行，或環境變數錯誤。確認已執行 migration 與 seed，並檢查 `NEXT_PUBLIC_SUPABASE_URL` 只有根網址（沒有 `/rest/v1/`）。

**Q. 球友端某些時段一直顯示「不可預約」**
A. 檢查：場地是否停用、是否有關閉時段、該時段是否有啟用中的價格規則完整涵蓋（例如營業到 23:00 但價格只設到 22:00）。

**Q. 登入後顯示「此帳號沒有後台權限」**
A. 該帳號還沒加入 `public.profiles`，請依「建立管理員帳號」第 3 步執行 SQL。

**Q. 想修改營業時間、取消期限、可預約天數**
A. 後台「營業時間」與「系統設定」可直接修改，不需改程式。可預約天數預設 30 天，取消期限預設開始前 2 小時。

**Q. 修改價格會影響已經建立的預約嗎？**
A. 不會。預約建立時的價格會存在預約資料中。

**Q. `completed` 狀態沒有自動更新？**
A. 系統在開啟後台首頁或預約列表時更新。若需要定時更新，可在 Supabase 啟用 pg_cron 後執行：
`select cron.schedule('complete-bookings', '*/15 * * * *', 'select public.complete_finished_bookings()');`

**Q. Windows 執行 `npm run build` 出現 `EXDEV: cross-device link not permitted`**
A. 這是 Next.js 寫入使用統計設定檔的問題，與專案無關。先執行 `$env:NEXT_TELEMETRY_DISABLED='1'` 再 build。

---

## 第二階段預留

架構已保留擴充空間（例如 `pricing_rules.member_price`、`profiles.role`、`bookings.source`），未來可加入：會員系統、季繳／半年會員、零打報名、羽球教學、教練管理、商品、營收／支出報表、LINE／Email 通知、線上付款。目前皆未實作。
