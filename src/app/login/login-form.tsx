"use client";

import { useActionState } from "react";

import { buttonBrand, errorTextClass, inputClass, labelClass } from "@/components/ui/styles";

import { signIn, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(signIn, {
    error: null,
    email: "",
  });

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          密碼
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      {state.error && (
        <p role="alert" className={errorTextClass}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${buttonBrand} w-full`}>
        {pending ? "登入中…" : "登入"}
      </button>
    </form>
  );
}
