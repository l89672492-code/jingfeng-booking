/**
 * 建置後檢查：確認瀏覽器端程式碼（.next/static）沒有包含 Supabase secret key。
 * 用法：npm run build && npm run check:bundle
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const staticDir = path.join(root, ".next", "static");

function readEnvFile(file) {
  const values = {};
  if (!existsSync(file)) return values;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

const env = { ...readEnvFile(path.join(root, ".env.local")), ...process.env };
const secrets = [env.SUPABASE_SECRET_KEY, env.SUPABASE_SERVICE_ROLE_KEY].filter(
  (value) => value && value.length > 10,
);
// 就算沒有設定實際金鑰，也不應出現 secret key 的前綴或環境變數名稱
const patterns = [...secrets, "sb_secret_", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

if (!existsSync(staticDir)) {
  console.error("找不到 .next/static，請先執行 npm run build");
  process.exit(1);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

const leaks = [];
let fileCount = 0;
for (const file of walk(staticDir)) {
  if (!/\.(js|css|html|json|txt|map)$/.test(file)) continue;
  fileCount += 1;
  const content = readFileSync(file, "utf8");
  for (const pattern of patterns) {
    if (content.includes(pattern)) {
      leaks.push(`${path.relative(root, file)} 含有 ${pattern === secrets[0] || pattern === secrets[1] ? "secret key 實際值" : pattern}`);
    }
  }
}

if (leaks.length > 0) {
  console.error("❌ 瀏覽器端程式碼含有機密資訊：");
  for (const leak of leaks) console.error("  -", leak);
  process.exit(1);
}

console.log(`✅ 已檢查 ${fileCount} 個瀏覽器端檔案，沒有發現 secret key（實際值檢查：${secrets.length > 0 ? "有" : "未設定金鑰，只檢查前綴"}）。`);
