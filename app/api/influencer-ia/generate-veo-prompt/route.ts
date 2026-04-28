/**
 * POST /api/influencer-ia/generate-veo-prompt
 *
 * Generates VEO 3.1 JSON prompts for the Influencer IA wizard.
 * Returns one prompt object per video scene based on duration/style selection.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { generateVeoPrompts } from "@/lib/influencer-ia/veo-prompt";
import type { VeoDuration, VeoStyle } from "@/lib/influencer-ia/veo-prompt";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/influencer-ia/generate-veo-prompt");

const VALID_STYLES: VeoStyle[] = [
  "ugc",
  "unboxing",
  "review",
  "tutorial",
  "testemunho",
];
const VALID_DURATIONS: VeoDuration[] = ["short", "medium", "full"];

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const body = (await req.json()) as {
      productName?: unknown;
      productCategory?: unknown;
      style?: unknown;
      duration?: unknown;
    };

    const productName =
      typeof body.productName === "string" ? body.productName.trim() : "";
    const productCategory =
      typeof body.productCategory === "string"
        ? body.productCategory.trim() || null
        : null;
    const style: VeoStyle = VALID_STYLES.includes(body.style as VeoStyle)
      ? (body.style as VeoStyle)
      : "ugc";
    const duration: VeoDuration = VALID_DURATIONS.includes(
      body.duration as VeoDuration,
    )
      ? (body.duration as VeoDuration)
      : "short";

    if (!productName) {
      return NextResponse.json(
        { error: "productName é obrigatório." },
        { status: 400 },
      );
    }

    const parts = await generateVeoPrompts(
      productName,
      productCategory,
      style,
      duration,
    );

    return NextResponse.json({ parts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("generate-veo-prompt failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
