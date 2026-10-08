/**
 * 靜態檢查：確保 secret key 與 server 端程式不會進入瀏覽器程式碼。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const files = sourceFiles(SRC).map((file) => ({
  file: path.relative(SRC, file).replaceAll("\\", "/"),
  content: readFileSync(file, "utf8"),
}));

/** 非 type-only 的 import 路徑 */
function runtimeImports(content: string): string[] {
  const imports: string[] = [];
  for (const match of content.matchAll(/^import\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm)) {
    imports.push(match[1]);
  }
  return imports;
}

describe("Secret key 不會暴露給瀏覽器", () => {
  it("secret key 只在 lib/supabase/admin.ts 讀取", () => {
    const readers = files
      .filter(({ content }) => /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(content))
      .map(({ file }) => file);
    expect(readers).toEqual(["lib/supabase/admin.ts"]);
  });

  it("沒有任何 NEXT_PUBLIC_ 變數名稱包含 SECRET 或 SERVICE", () => {
    for (const { file, content } of files) {
      expect(content, file).not.toMatch(/NEXT_PUBLIC_\w*(SECRET|SERVICE)/);
    }
  });

  it("admin.ts、server.ts、public.ts 與 src/server/* 都有 server-only 保護", () => {
    const serverModules = files.filter(
      ({ file }) =>
        file.startsWith("server/") ||
        ["lib/supabase/admin.ts", "lib/supabase/server.ts", "lib/supabase/public.ts"].includes(file),
    );
    expect(serverModules.length).toBeGreaterThan(5);
    for (const { file, content } of serverModules) {
      expect(content, file).toMatch(/^import "server-only";/m);
    }
  });

  it("Client Component 不會直接匯入 server 端模組", () => {
    const clientFiles = files.filter(({ content }) => /^["']use client["'];/m.test(content));
    expect(clientFiles.length).toBeGreaterThan(5);
    for (const { file, content } of clientFiles) {
      for (const specifier of runtimeImports(content)) {
        expect(specifier, `${file} 匯入 ${specifier}`).not.toMatch(
          /^@\/server\/|^@\/lib\/supabase\/(admin|server|public)$/,
        );
      }
    }
  });
});
