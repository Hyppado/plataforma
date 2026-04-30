/**
 * lib/swr/useInfluencerDraft.ts
 *
 * Utilities for cross-device wizard draft persistence.
 *
 * loadDraft()  — GET /api/influencer-ia/draft → SessionSnapshot | null
 * saveDraft()  — PUT /api/influencer-ia/draft (debounced by callers)
 * deleteDraft() — DELETE /api/influencer-ia/draft
 */

"use client";

const DRAFT_URL = "/api/influencer-ia/draft";

export async function loadDraft<T>(): Promise<T | null> {
  try {
    const res = await fetch(DRAFT_URL);
    if (!res.ok) return null;
    const body = (await res.json()) as { draft: T | null };
    return body.draft ?? null;
  } catch {
    return null;
  }
}

export async function saveDraft(data: unknown): Promise<void> {
  try {
    await fetch(DRAFT_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    // Best-effort — never let a save failure break the UI
  }
}

export async function deleteDraft(): Promise<void> {
  try {
    await fetch(DRAFT_URL, { method: "DELETE" });
  } catch {
    // Best-effort
  }
}
