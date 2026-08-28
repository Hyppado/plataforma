"use client";

import { useState, useCallback } from "react";
import { copyTextToClipboard } from "@/lib/clipboard";

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
export function useCopyToClipboard(resetMs = 2500): UseCopyToClipboardResult {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const copy = useCallback(
    async (text: string) => {
      // copyTextToClipboard já cobre contexto inseguro, permissão negada e
      // navegador sem Clipboard API, caindo em execCommand quando preciso.
      const ok = await copyTextToClipboard(text);
      setCopyState(ok ? "success" : "error");
      setTimeout(() => setCopyState("idle"), resetMs);
    },
    [resetMs],
  );

  return { copyState, copy };
}
