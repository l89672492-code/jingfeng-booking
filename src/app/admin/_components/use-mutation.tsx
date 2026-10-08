"use client";

import { useState, useTransition } from "react";

import type { MutationResult } from "@/server/admin/config";

export type FormMessage = { tone: "success" | "error"; text: string } | null;

/** 呼叫 Server Action 並管理「處理中」與結果訊息 */
export function useMutation() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<FormMessage>(null);

  function run(
    action: () => Promise<MutationResult>,
    options: { successText?: string; onSuccess?: () => void } = {},
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (options.successText) setMessage({ tone: "success", text: options.successText });
        options.onSuccess?.();
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  return { isPending, message, setMessage, run };
}

export function MessageText({ message }: { message: FormMessage }) {
  if (!message) return null;
  return (
    <p
      role={message.tone === "error" ? "alert" : "status"}
      className={`text-sm ${message.tone === "error" ? "text-red-700" : "text-green-700"}`}
    >
      {message.text}
    </p>
  );
}
