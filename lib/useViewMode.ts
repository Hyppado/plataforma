"use client";

import { useState } from "react";

export type ViewMode = "card" | "list";

export function useViewMode(
  storageKey: string,
  defaultMode: ViewMode = "card",
): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    const stored = localStorage.getItem(storageKey);
    return stored === "card" || stored === "list" ? stored : defaultMode;
  });

  const set = (newMode: ViewMode) => {
    setMode(newMode);
    try {
      localStorage.setItem(storageKey, newMode);
    } catch {
      // ignore quota errors
    }
  };

  return [mode, set];
}
