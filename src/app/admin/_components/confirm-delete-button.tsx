"use client";

import { useState } from "react";

import type { MutationResult } from "@/server/admin/config";

import { MessageText, useMutation } from "./use-mutation";

/** 兩段式刪除按鈕（先按「刪除」，再按「確定」） */
export function ConfirmDeleteButton({ action }: { action: () => Promise<MutationResult> }) {
  const [confirming, setConfirming] = useState(false);
  const { isPending, message, run } = useMutation();

  return (
    <div className="flex items-center justify-end gap-2">
      <MessageText message={message} />
      {confirming ? (
        <>
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-2 py-1 text-sm"
            onClick={() => setConfirming(false)}
          >
            取消
          </button>
          <button
            type="button"
            disabled={isPending}
            className="rounded-lg bg-red-600 px-2 py-1 text-sm text-white disabled:opacity-50"
            onClick={() => run(action, { onSuccess: () => setConfirming(false) })}
          >
            確定刪除
          </button>
        </>
      ) : (
        <button
          type="button"
          className="rounded-lg border border-red-300 px-2 py-1 text-sm text-red-700 hover:bg-red-50"
          onClick={() => setConfirming(true)}
        >
          刪除
        </button>
      )}
    </div>
  );
}
