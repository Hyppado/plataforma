import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/echotik/videos/trending
 *
 * Retorna vídeos trending do TikTok Shop a partir do banco de dados
 * (sincronizado pelo cron EchoTik).
 *
 * Query params:
 *   - date:     ISO date (YYYY-MM-DD) — default: hoje
 *   - country:  código do país — default: todos
 *   - category: externalId da categoria — filtra por categoryId
 *   - limit:    max resultados — default: 50, max: 200
 *   - sort:     campo de ordenação — default: views
 *   - order:    asc | desc — default: desc
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse date
    const dateParam = searchParams.get("date");
    let date: Date;
    if (dateParam) {
      date = new Date(dateParam);
      date.setUTCHours(0, 0, 0, 0);
    } else {
      date = new Date();
      date.setUTCHours(0, 0, 0, 0);
    }

    // Filters
    const country = searchParams.get("country") || undefined;
    const category = searchParams.get("category") || undefined;
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
      200,
    );

    // Sort
    const sortField = searchParams.get("sort") || "views";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";

    const allowedSorts = [
      "views",
      "likes",
      "comments",
      "shares",
      "saleCount",
      "gmv",
      "favorites",
    ];
    const sortBy = allowedSorts.includes(sortField) ? sortField : "views";

    // Build where clause
    const where: Record<string, unknown> = { date };
    if (country) where.country = country;
    if (category) where.categoryId = category;

    const videos = await prisma.echotikVideoTrendDaily.findMany({
      where,
      orderBy: { [sortBy]: order },
      take: limit,
    });

    // Serialize BigInt fields to numbers for JSON
    const serialized = videos.map((v) => ({
      id: v.id,
      date: v.date.toISOString().split("T")[0],
      videoExternalId: v.videoExternalId,
      title: v.title,
      authorName: v.authorName,
      authorExternalId: v.authorExternalId,
      views: Number(v.views),
      likes: Number(v.likes),
      comments: Number(v.comments),
      favorites: Number(v.favorites),
      shares: Number(v.shares),
      saleCount: Number(v.saleCount),
      gmv: Number(v.gmv),
      currency: v.currency,
      country: v.country,
      categoryId: v.categoryId,
      syncedAt: v.syncedAt.toISOString(),
    }));

    // Se hoje não tem dados, tentar o dia mais recente
    if (serialized.length === 0 && !dateParam) {
      const latest = await prisma.echotikVideoTrendDaily.findFirst({
        orderBy: { date: "desc" },
        select: { date: true },
      });

      if (latest) {
        const latestWhere: Record<string, unknown> = { date: latest.date };
        if (country) latestWhere.country = country;
        if (category) latestWhere.categoryId = category;

        const fallbackVideos = await prisma.echotikVideoTrendDaily.findMany({
          where: latestWhere,
          orderBy: { [sortBy]: order },
          take: limit,
        });

        const fallbackSerialized = fallbackVideos.map((v) => ({
          id: v.id,
          date: v.date.toISOString().split("T")[0],
          videoExternalId: v.videoExternalId,
          title: v.title,
          authorName: v.authorName,
          authorExternalId: v.authorExternalId,
          views: Number(v.views),
          likes: Number(v.likes),
          comments: Number(v.comments),
          favorites: Number(v.favorites),
          shares: Number(v.shares),
          saleCount: Number(v.saleCount),
          gmv: Number(v.gmv),
          currency: v.currency,
          country: v.country,
          categoryId: v.categoryId,
          syncedAt: v.syncedAt.toISOString(),
        }));

        return NextResponse.json({
          videos: fallbackSerialized,
          source: "database",
          date: latest.date.toISOString().split("T")[0],
          count: fallbackSerialized.length,
          note: "Dados do dia mais recente disponível",
          timestamp: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      videos: serialized,
      source: "database",
      date: date.toISOString().split("T")[0],
      count: serialized.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/echotik/videos/trending] Erro:", error);
    return NextResponse.json(
      {
        videos: [],
        source: "database",
        count: 0,
        error: "Erro ao buscar vídeos trending",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
