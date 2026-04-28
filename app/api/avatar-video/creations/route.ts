/**
 * app/api/avatar-video/creations/route.ts
 *
 * POST /api/avatar-video/creations
 *
 * Starts an avatar video generation flow from a TikTok Shop product.
 * Validates the product exists in the Echotik ingested data, then gets
 * or creates a DRAFT AvatarVideoCreation and saves the product snapshot.
 *
 * Body: { productExternalId, selectedProductImageUrl, source }
 * Returns: { id: string }  (the creation ID)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import {
  getOrCreateDraftCreation,
  updateCreationProduct,
  listCreations,
} from "@/lib/avatar-video/service";
import type { ProductSelection } from "@/lib/avatar-video/types";

const log = createLogger("api/avatar-video/creations");

export const dynamic = "force-dynamic";

const VALID_SOURCES = ["products-hype", "new-products"] as const;
type Source = (typeof VALID_SOURCES)[number];

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

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

  const { productExternalId, selectedProductImageUrl, source } = body as Record<
    string,
    unknown
  >;

  if (typeof productExternalId !== "string" || !productExternalId.trim()) {
    return NextResponse.json(
      { error: "productExternalId é obrigatório" },
      { status: 400 },
    );
  }

  if (
    typeof selectedProductImageUrl !== "string" ||
    !selectedProductImageUrl.trim()
  ) {
    return NextResponse.json(
      { error: "selectedProductImageUrl é obrigatório" },
      { status: 400 },
    );
  }

  if (!VALID_SOURCES.includes(source as Source)) {
    return NextResponse.json(
      { error: "source deve ser 'products-hype' ou 'new-products'" },
      { status: 400 },
    );
  }

  try {
    // Validate product exists in Echotik ingested data.
    // EchotikProductDetail is the primary source (contains full image data).
    // EchotikProductTrendDaily is the fallback for hype products not yet in detail.
    const [detail, trend] = await Promise.all([
      prisma.echotikProductDetail.findUnique({
        where: { productExternalId },
        select: {
          productName: true,
          blobUrl: true,
          coverUrl: true,
          avgPrice: true,
          categoryId: true,
        },
      }),
      prisma.echotikProductTrendDaily.findFirst({
        where: { productExternalId },
        orderBy: { date: "desc" },
        select: {
          productName: true,
          avgPrice: true,
          categoryId: true,
          currency: true,
        },
      }),
    ]);

    if (!detail && !trend) {
      log.warn("Product not found in Echotik data", {
        userId: auth.userId,
        productExternalId,
        source,
      });
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 },
      );
    }

    // Build the product snapshot from DB data, preferring EchotikProductDetail.
    const productName = detail?.productName ?? trend?.productName ?? "";
    const productImageUrl =
      detail?.blobUrl || detail?.coverUrl || selectedProductImageUrl;
    // avgPrice in EchotikProductDetail is stored in cents (divided by 100 for display).
    // avgPrice in EchotikProductTrendDaily is stored as the raw spu_avg_price value.
    const productPriceCents =
      detail?.avgPrice != null
        ? Math.round(Number(detail.avgPrice))
        : trend?.avgPrice != null
          ? Math.round(trend.avgPrice)
          : null;
    const productCurrency = trend?.currency ?? "USD";
    const productCategory = detail?.categoryId ?? trend?.categoryId ?? null;

    const product: ProductSelection = {
      productExternalId,
      productName,
      productImageUrl,
      productSelectedImageUrl: selectedProductImageUrl,
      productPriceCents,
      productCurrency,
      productCategory,
    };

    // Get the user's active DRAFT creation, or create a new one.
    const draftResult = await getOrCreateDraftCreation(auth.userId);
    if (!draftResult.ok) {
      log.error("Failed to get or create draft creation", {
        userId: auth.userId,
        error: draftResult.error,
      });
      return NextResponse.json({ error: draftResult.error }, { status: 500 });
    }

    const creationId = draftResult.data.id;

    // Save the product snapshot on the draft.
    const updateResult = await updateCreationProduct(
      auth.userId,
      creationId,
      product,
    );
    if (!updateResult.ok) {
      log.error("Failed to save product on creation", {
        userId: auth.userId,
        creationId,
        error: updateResult.error,
        code: updateResult.code,
      });
      const status =
        updateResult.code === "not_found"
          ? 404
          : updateResult.code === "invalid_state"
            ? 409
            : 500;
      return NextResponse.json({ error: updateResult.error }, { status });
    }

    log.info("Avatar video creation started from product", {
      userId: auth.userId,
      creationId,
      productExternalId,
      source,
    });

    return NextResponse.json({ id: creationId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/avatar-video/creations failed", {
      userId: auth.userId,
      error: message,
    });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;

  try {
    const result = await listCreations(auth.userId, { limit, cursor });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ creations: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("GET /api/avatar-video/creations failed", {
      userId: auth.userId,
      error: message,
    });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
