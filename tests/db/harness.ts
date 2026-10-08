/**
 * 資料庫測試環境：以 PGlite（WASM 版 PostgreSQL）執行真正的 migration 與 seed。
 * 先建立與 Supabase 相同的角色與 auth schema，讓 RLS 與權限設定能被實際驗證。
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { PGlite, type Transaction } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const ROOT = path.resolve(__dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const SEED_FILE = path.join(ROOT, "supabase", "seed.sql");

/** 模擬 Supabase 平台預先存在的角色、schema 與預設權限 */
const SUPABASE_SHIM = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema extensions;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export type Role = "anon" | "authenticated" | "service_role";

export async function createTestDatabase() {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(SUPABASE_SHIM);

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  await db.exec(readFileSync(SEED_FILE, "utf8"));

  return db;
}

/** 以指定角色（與登入者）在交易中執行，模擬 PostgREST 的權限切換 */
export async function asRole<T>(
  db: PGlite,
  role: Role,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    if (userId) {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    }
    return fn(tx);
  });
}

/** 清空測試間會變動的資料，保留 seed 的基礎設定 */
export async function resetData(db: PGlite) {
  await db.exec(`
    truncate public.bookings, public.blocked_slots, public.holidays,
             public.booking_number_counters, public.profiles, auth.users cascade;
    update public.courts set status = 'active';
    update public.system_settings set value = '2' where key = 'cancellation_deadline_hours';
    update public.system_settings set value = '30' where key = 'booking_max_days_ahead';
    delete from public.pricing_rules where day_type = 'special';
    update public.pricing_rules set active = true;
  `);
}

export async function getCourtId(db: PGlite, name: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    "select id from public.courts where name = $1",
    [name],
  );
  return result.rows[0].id;
}

/** 建立後台帳號並回傳 user id */
export async function createStaffUser(db: PGlite, role: "admin" | "staff" | null) {
  const id = crypto.randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [
    id,
    `${id}@example.test`,
  ]);
  if (role) {
    await db.query("insert into public.profiles (id, name, role) values ($1, $2, $3)", [
      id,
      "測試人員",
      role,
    ]);
  }
  return id;
}
