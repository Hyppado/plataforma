"use client";

import { useState, useCallback } from "react";

type CopyState = "idle" | "success" | "error";

interface UseCopyToClipboardResult {
  copyState: CopyState;
  copy: (text: string) => Promise<void>;
}

/**
 * Copies text to the clipboard and tracks the outcome.
 *
 * copyState:
 *   "idle"    — no recent copy attempt
 *   "success" — text was copied successfully
 *   "error"   — clipboard write failed (permissions denied, etc.)
 *
 * Both states reset to "idle" after `resetMs` milliseconds (default 2500 ms).
 */
export function useCopyToClipboard(
  resetMs = 2500,
): UseCopyToClipboardResult {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopyState("success");
      } catch {
        setCopyState("error");
      } finally {
        setTimeout(() => setCopyState("idle"), resetMs);
      }
    },
    [resetMs],
  );

  return { copyState, copy };
}
