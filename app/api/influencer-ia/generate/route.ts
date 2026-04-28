/**
 * app/api/influencer-ia/generate/route.ts
 *
 * POST /api/influencer-ia/generate
 *
 * Generates a UGC-style influencer image using Google AI Studio (Gemini).
 * Requires auth. No quota consumed in MVP — can be gated later.
 *
 * Body:
 *   productImageUrl?   — absolute product image URL (server-fetchable)
 *   productName?       — product display name
 *   productCategory?   — product category (used to infer placement style)
 *   avatarId?          — AvatarProfile.id (fetches image + name from DB)
 *   avatarImageUrl?    — uploaded avatar image URL (overrides avatarId image)
 *   pose?              — preset pose label
 *   customPose?        — free-text pose override
 *   environment?       — preset environment label
 *   customEnvironment? — free-text environment override
 *   style?             — influencer style label
 *   enhancements?      — array of enhancement labels
 *
 * Response: { imageUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { generateInfluencerImage } from "@/lib/influencer-ia/generate";

const log = createLogger("api/influencer-ia/generate");

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  let body: {
    productImageUrl?: string;
    productName?: string;
    productCategory?: string;
    avatarId?: string;
    avatarImageUrl?: string;
    pose?: string;
    customPose?: string;
    environment?: string;
    customEnvironment?: string;
    style?: string;
    enhancements?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 },
    );
  }

  try {
    let avatarName: string | null = null;
    let avatarDescription: string | null = null;
    let avatarImageUrl: string | null = body.avatarImageUrl ?? null;

    if (body.avatarId) {
      const avatar = await prisma.avatarProfile.findUnique({
        where: { id: body.avatarId },
        select: { name: true, description: true, imageUrl: true },
      });
      if (avatar) {
        avatarName = avatar.name;
        avatarDescription = avatar.description;
        if (!avatarImageUrl) avatarImageUrl = avatar.imageUrl;
      }
    }

    const result = await generateInfluencerImage({
      avatarImageUrl,
      avatarName,
      avatarDescription,
      productImageUrl: body.productImageUrl ?? null,
      productName: body.productName ?? null,
      productCategory: body.productCategory ?? null,
      pose: body.pose ?? null,
      customPose: body.customPose ?? null,
      environment: body.environment ?? null,
      customEnvironment: body.customEnvironment ?? null,
      style: body.style ?? null,
      enhancements: Array.isArray(body.enhancements) ? body.enhancements : [],
    });

    return NextResponse.json({ imageUrl: result.imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    log.error("Influencer IA generation failed", {
      error: message,
      userId: auth.userId,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
