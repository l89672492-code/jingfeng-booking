"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null; email: string };

const loginSchema = z.object({
  email: z.email("請輸入正確的 Email"),
  password: z.string().min(1, "請輸入密碼"),
});

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = loginSchema.safeParse({ email, password: formData.get("password") ?? "" });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "請輸入帳號密碼", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "帳號或密碼錯誤。", email };
  }

  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
