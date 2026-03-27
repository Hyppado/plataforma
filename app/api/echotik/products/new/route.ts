import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthed } from "@/lib/auth";
import { getNewProducts } from "@/lib/echotik/products";

export const dynamic = "force-dynamic";

/**
 * GET /api/echotik/products/new
 *
 * Proxy seguro para a API Echotik Product List, filtrando por
 * `first_crawl_dt` dos últimos 3 dias (produtos novos).
 *
 * Query params aceitos:
 *   - region    (default "BR")
 *   - page      (default 1, mín 1)
 *   - pageSize  (default 10, máx 10 — limite da API)
 *   - daysBack  (default 3, máx 30)
 *   - sort      (0-7, default 1 = total_sale_cnt)
 *   - order     (0=asc, 1=desc, default 1)
 *   - category  (category_id)
 *   - search    (keyword)
 *
 * As credenciais da Echotik ficam exclusivamente no servidor.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);

    const region = (searchParams.get("region") || "BR").toUpperCase();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      10,
      Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)),
    );
    const daysBack = Math.min(
      30,
      Math.max(1, parseInt(searchParams.get("daysBack") || "3", 10)),
    );
    const sortField = Math.min(
      7,
      Math.max(0, parseInt(searchParams.get("sort") || "1", 10)),
    );
    const sortType = searchParams.get("order") === "0" ? 0 : 1;
    const categoryId = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;

    const result = await getNewProducts({
      region,
      page,
      pageSize,
      daysBack,
      sortField,
      sortType,
      categoryId,
      search,
    });

    return NextResponse.json({
      success: true,
      data: {
        items: result.items,
        count: result.count,
        page: result.page,
        dateWindow: result.dateWindow,
        region,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/echotik/products/new] Error:", message);

    // Distinguir quota/rate-limit de erros genéricos
    const isQuota =
      message.includes("Quota") || message.includes("Usage Limit");
    const status = isQuota ? 429 : 500;

    return NextResponse.json(
      {
        success: false,
        error: isQuota
          ? "Limite de uso da API atingido. Tente mais tarde."
          : "Falha ao buscar novos produtos.",
      },
      { status },
    );
  }
}
