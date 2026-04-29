/**
 * app/api/influencer-ia/generate/route.ts
 *
 * POST /api/influencer-ia/generate
 *
 * Generates a UGC-style influencer image using Google AI Studio (Gemini).
 * Requires auth. Daily quota: 5 generations per user per calendar day (UTC).
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
import {
  assertInfluencerDailyQuota,
  consumeInfluencerGeneration,
  DailyQuotaExceededError,
} from "@/lib/influencer-ia/quota";

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
    // Enforce daily quota before calling external services
    await assertInfluencerDailyQuota(auth.userId);
  } catch (err) {
    if (err instanceof DailyQuotaExceededError) {
      return NextResponse.json(
        {
          error: `Limite diário de ${err.limit} gerações atingido. Tente novamente amanhã.`,
          used: err.used,
          limit: err.limit,
        },
        { status: 429 },
      );
    }
    throw err;
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

    // Consume quota after successful generation
    await consumeInfluencerGeneration(auth.userId);

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
