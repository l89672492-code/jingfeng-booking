# 勁丰羽球館｜場地租借預約系統

專案名稱：`jingfeng-booking`

## 技術

- Next.js 16（App Router）
- TypeScript
- Tailwind CSS v4
- ESLint
- Supabase（`@supabase/supabase-js`、`@supabase/ssr`）

## 環境需求

- Node.js 20 以上（建議 LTS）
- npm

## 開始使用

```bash
npm install
cp .env.example .env.local   # Windows PowerShell：Copy-Item .env.example .env.local
npm run dev
```

開啟 http://localhost:3000

### 環境變數

於 `.env.local` 填入 Supabase 專案設定（Supabase 後台 → Project Settings → API Keys）：

| 變數 | 說明 | 可否給瀏覽器 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案根網址（不含 `/rest/v1/`） | 可 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key（`sb_publishable_...`） | 可 |
| `SUPABASE_SECRET_KEY` | Secret key（`sb_secret_...`），會略過 RLS | **絕對不可** |

- `.env.local` 不會被提交到 Git。
- Secret key 不可加上 `NEXT_PUBLIC_` 前綴，否則會被打包進瀏覽器程式碼。

## 指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run lint` | 執行 ESLint 檢查 |
| `npm run build` | 建置正式版本 |
| `npm run start` | 啟動正式版本（需先 build） |

## 資料夾結構

```
jingfeng-booking/
├─ public/                 靜態檔案
├─ src/
│  ├─ app/                 App Router 路由與頁面
│  ├─ components/          共用 UI 元件
│  ├─ constants/           系統常數設定
│  ├─ lib/
│  │  ├─ supabase/
│  │  │  ├─ env.ts         公開環境變數讀取與檢查
│  │  │  ├─ client.ts      瀏覽器端 client（publishable key）
│  │  │  ├─ server.ts      伺服器端 client（publishable key + 使用者 cookie）
│  │  │  └─ admin.ts       管理端 client（secret key，僅限伺服器）
│  │  └─ utils/            共用工具函式
│  └─ types/
│     └─ database.ts       Supabase 資料庫型別（建立資料表後以 CLI 產生）
├─ supabase/
│  └─ migrations/          資料庫 migration SQL
└─ .env.example            環境變數範本
```

## Supabase 使用方式

```ts
// Server Component / Server Function / Route Handler
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Client Component
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

// 僅限伺服器端、需要略過 RLS 的管理操作
import { createAdminClient } from "@/lib/supabase/admin";
const admin = createAdminClient();
```

`server.ts` 與 `admin.ts` 皆以 `server-only` 保護，若被 Client Component 匯入，build 會失敗。

所有正式資料皆來自 Supabase，不使用假資料。

## 開發階段

- [x] 第一階段：專案初始化
