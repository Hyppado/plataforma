/**
 * app/api/avatar-video/creations/[id]/route.ts
 *
 * GET  /api/avatar-video/creations/[id] — Load creation state (owner only)
 * PATCH /api/avatar-video/creations/[id] — Update selections on a DRAFT creation
 *
 * GET returns the full creation DTO including imageVariations and prompt,
 * allowing the UI to restore any step in the generation flow.
 *
 * PATCH body (all optional):
 *   avatarId                  — AvatarProfile id from the library
 *   uploadedAvatarImageUrl    — Vercel Blob URL of user-uploaded reference image
 *   scenarioId                — VideoScenario id from the library
 *   customScenarioDescription — Free-text description (for custom scenario)
 *   tone                      — Delivery tone ("professional", "casual", …)
 *   duration                  — Target video duration ("15s", "30s", "60s", …)
 *   takeCount                 — Number of takes to generate (1–5)
 *
 * Returns: { creation: CreationDTO }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import {
  getCreationDetail,
  updateCreationSelections,
} from "@/lib/avatar-video/service";
import type { CreationSelections } from "@/lib/avatar-video/types";

const log = createLogger("api/avatar-video/creations/[id]");

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const creationId = params.id;
  if (!creationId || typeof creationId !== "string") {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const result = await getCreationDetail(auth.userId, creationId);

    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ creation: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    log.error("Unexpected error in GET creation", {
      userId: auth.userId,
      creationId,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const creationId = params.id;
  if (!creationId || typeof creationId !== "string") {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 },
    );
  }

  const {
    avatarId,
    uploadedAvatarImageUrl,
    scenarioId,
    customScenarioDescription,
    tone,
    duration,
    takeCount,
  } = body as Record<string, unknown>;

  // Validate types of provided fields
  if (
    avatarId !== undefined &&
    avatarId !== null &&
    typeof avatarId !== "string"
  ) {
    return NextResponse.json(
      { error: "avatarId deve ser string ou null" },
      { status: 400 },
    );
  }
  if (
    uploadedAvatarImageUrl !== undefined &&
    uploadedAvatarImageUrl !== null &&
    typeof uploadedAvatarImageUrl !== "string"
  ) {
    return NextResponse.json(
      { error: "uploadedAvatarImageUrl deve ser string ou null" },
      { status: 400 },
    );
  }
  if (
    scenarioId !== undefined &&
    scenarioId !== null &&
    typeof scenarioId !== "string"
  ) {
    return NextResponse.json(
      { error: "scenarioId deve ser string ou null" },
      { status: 400 },
    );
  }
  if (
    customScenarioDescription !== undefined &&
    customScenarioDescription !== null &&
    typeof customScenarioDescription !== "string"
  ) {
    return NextResponse.json(
      { error: "customScenarioDescription deve ser string ou null" },
      { status: 400 },
    );
  }
  if (tone !== undefined && tone !== null && typeof tone !== "string") {
    return NextResponse.json(
      { error: "tone deve ser string ou null" },
      { status: 400 },
    );
  }
  if (
    duration !== undefined &&
    duration !== null &&
    typeof duration !== "string"
  ) {
    return NextResponse.json(
      { error: "duration deve ser string ou null" },
      { status: 400 },
    );
  }
  if (
    takeCount !== undefined &&
    takeCount !== null &&
    (typeof takeCount !== "number" ||
      !Number.isInteger(takeCount) ||
      takeCount < 1 ||
      takeCount > 5)
  ) {
    return NextResponse.json(
      { error: "takeCount deve ser um número inteiro entre 1 e 5" },
      { status: 400 },
    );
  }

  // Build selections object — only include keys that were present in the body
  const selections: CreationSelections = {};
  if ("avatarId" in (body as object))
    selections.avatarProfileId = (avatarId as string | null) ?? null;
  if ("uploadedAvatarImageUrl" in (body as object))
    selections.uploadedAvatarImageUrl =
      (uploadedAvatarImageUrl as string | null) ?? null;
  if ("scenarioId" in (body as object))
    selections.videoScenarioId = (scenarioId as string | null) ?? null;
  if ("customScenarioDescription" in (body as object))
    selections.customScenarioDescription =
      (customScenarioDescription as string | null) ?? null;
  if ("tone" in (body as object))
    selections.tone = (tone as string | null) ?? null;
  if ("duration" in (body as object))
    selections.duration = (duration as string | null) ?? null;
  if ("takeCount" in (body as object))
    selections.takeCount = (takeCount as number | null) ?? null;

  const result = await updateCreationSelections(
    auth.userId,
    creationId,
    selections,
  );

  if (!result.ok) {
    log.warn("updateCreationSelections failed", {
      userId: auth.userId,
      creationId,
      code: result.code,
      error: result.error,
    });
    const status =
      result.code === "not_found"
        ? 404
        : result.code === "invalid_state"
          ? 409
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  log.info("Creation selections updated via PATCH", {
    userId: auth.userId,
    creationId,
  });

  return NextResponse.json({ creation: result.data });
}
