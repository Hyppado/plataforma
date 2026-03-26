/**
 * Echotik Product List service
 *
 * Encapsula a chamada ao endpoint `GET /api/v3/echotik/product/list` da
 * Echotik, fornecendo tipagem, normalização e cálculo automático da janela
 * "últimos N dias" via `min_first_crawl_dt` / `max_first_crawl_dt`.
 *
 * Uso:
 *   import { getNewProducts } from "@/lib/echotik/products";
 *   const result = await getNewProducts({ region: "BR", page: 1 });
 *
 * Segurança: esta função roda exclusivamente no servidor (usa `echotikRequest`
 * que lê env vars de credenciais). Nunca importar diretamente no frontend.
 */

import { echotikRequest } from "./client";
import { newProductDateWindow } from "./dates";
import { proxyIfEchotikCdn } from "./trending";
import type { ProductDTO } from "@/lib/types/dto";

// ---------------------------------------------------------------------------
// Tipos brutos da resposta da Echotik (Product List endpoint)
// ---------------------------------------------------------------------------

/** Item individual retornado pelo endpoint /api/v3/echotik/product/list */
export interface EchotikProductListItem {
  product_id: string;
  product_name: string;
  cover_url?: string; // JSON string: [{ url, index }]
  category_id?: string;
  category_l2_id?: string;
  category_l3_id?: string;
  min_price?: number;
  max_price?: number;
  spu_avg_price?: number;
  product_commission_rate?: number;
  product_rating?: number;
  review_count?: number;
  region?: string;

  first_crawl_dt?: number; // yyyyMMdd como inteiro, ex: 20260321
  off_mark?: number; // <2 = not offline
  free_shipping?: number; // 1=yes, 0=no
  discount?: string;
  sales_trend_flag?: number; // 0=stable, 1=up, 2=down

  // --- Vendas totais ---
  total_sale_cnt?: number;
  total_sale_7d_cnt?: number;
  total_sale_30d_cnt?: number;
  total_sale_gmv_amt?: number;
  total_sale_gmv_7d_amt?: number;
  total_sale_gmv_30d_amt?: number;

  // --- Criadores / influenciadores ---
  total_ifl_cnt?: number;
  total_ifl_video_7d_cnt?: number;
  total_ifl_live_7d_cnt?: number;

  // --- Vídeos ---
  total_video_cnt?: number;
  total_video_7d_cnt?: number;
  total_video_sale_cnt?: number;
  total_video_sale_gmv_amt?: number;

  // --- Lives ---
  total_live_cnt?: number;
  total_live_7d_cnt?: number;
  total_live_sale_cnt?: number;
  total_live_sale_gmv_amt?: number;

  // --- Views ---
  total_views_cnt?: number;
  total_views_7d_cnt?: number;

  seller_id?: string;
  is_s_shop?: number;
}

/** Resposta genérica da Echotik */
interface EchotikApiResponse<T> {
  code: number;
  message: string;
  data: T[];
  requestId: string;
}

// ---------------------------------------------------------------------------
// Parâmetros de entrada
// ---------------------------------------------------------------------------

export interface GetNewProductsParams {
  /** Código de região (default "BR") */
  region?: string;
  /** Número da página — começa em 1 (default 1) */
  page?: number;
  /** Tamanho da página — máx 10 segundo a API (default 10) */
  pageSize?: number;
  /** Janela em dias para considerar "produto novo" (default 3) */
  daysBack?: number;
  /** Campo de ordenação: 0=default 1=total_sale_cnt 2=total_sale_gmv_amt
   *  3=spu_avg_price 4=total_sale_7d_cnt 5=total_sale_30d_cnt
   *  6=total_sale_gmv_7d_amt 7=total_sale_gmv_30d_amt */
  sortField?: number;
  /** 0=asc, 1=desc (default 1) */
  sortType?: number;
  /** Filtro por categoria L1 */
  categoryId?: string;
  /** Keyword search (product name) */
  search?: string;
}

export interface GetNewProductsResult {
  items: ProductDTO[];
  /** Total de itens na página atual (a API não retorna contagem total global) */
  count: number;
  /** Página solicitada */
  page: number;
  /** Janela de datas usada */
  dateWindow: { min: string; max: string };
}

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

/**
 * Extrai a primeira URL de imagem do campo `cover_url` da Echotik.
 * O campo é uma string JSON contendo um array de `{ url, index }`.
 */
function parseCoverUrl(raw: string | undefined | null): string {
  if (!raw) return "";
  try {
    const arr = JSON.parse(raw) as { url: string; index: number }[];
    if (!Array.isArray(arr) || arr.length === 0) return "";
    // Pegar a imagem com menor index (capa principal)
    const sorted = [...arr].sort((a, b) => a.index - b.index);
    return sorted[0].url || "";
  } catch {
    // Se não for JSON válido, pode ser uma URL direta
    return raw.startsWith("http") ? raw : "";
  }
}

/**
 * Converte `first_crawl_dt` (inteiro yyyyMMdd) em string ISO "yyyy-MM-dd".
 */
function crawlDateToISO(dt: number | undefined): string {
  if (!dt) return "";
  const s = String(dt);
  if (s.length !== 8) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * Normaliza um item bruto da API Product List em `ProductDTO`.
 * Campos ausentes recebem valores-padrão seguros.
 */
export function normalizeProductListItem(
  item: EchotikProductListItem,
): ProductDTO {
  const coverRaw = parseCoverUrl(item.cover_url);

  return {
    id: item.product_id ?? "",
    name: item.product_name ?? "",
    imageUrl: proxyIfEchotikCdn(coverRaw),
    category: item.category_id ?? "",
    priceBRL: item.spu_avg_price ?? item.min_price ?? 0,
    launchDate: crawlDateToISO(item.first_crawl_dt),
    isNew: true,
    rating: item.product_rating ?? 0,
    sales: item.total_sale_cnt ?? 0,
    avgPriceBRL: item.spu_avg_price ?? 0,
    commissionRate: item.product_commission_rate ?? 0,
    revenueBRL: item.total_sale_gmv_amt ?? 0,
    liveRevenueBRL: item.total_live_sale_gmv_amt ?? 0,
    videoRevenueBRL: item.total_video_sale_gmv_amt ?? 0,
    mallRevenueBRL: 0,
    creatorCount: item.total_ifl_cnt ?? 0,
    creatorConversionRate: 0,
    sourceUrl: `https://echotik.live/products/${item.product_id}`,
    tiktokUrl: `https://www.tiktok.com/view/product/${item.product_id}`,
    dateRange: "3d",
  };
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

const PRODUCT_LIST_ENDPOINT = "/api/v3/echotik/product/list";

/**
 * Busca produtos recém-capturados (novos) na API Echotik.
 *
 * Usa `min_first_crawl_dt` e `max_first_crawl_dt` para filtrar produtos
 * cuja primeira captura ocorreu nos últimos `daysBack` dias (padrão 3).
 *
 * @throws {Error} quando a API retorna erro (propagado pelo `echotikRequest`)
 */
export async function getNewProducts(
  params: GetNewProductsParams = {},
): Promise<GetNewProductsResult> {
  const {
    region = "BR",
    page = 1,
    pageSize = 10,
    daysBack = 3,
    sortField = 1, // total_sale_cnt
    sortType = 1, // desc
    categoryId,
    search,
  } = params;

  const dateWindow = newProductDateWindow(daysBack);

  const queryParams: Record<string, string | number | undefined> = {
    region,
    page_num: page,
    page_size: Math.min(pageSize, 10), // API limita a 10
    min_first_crawl_dt: dateWindow.min,
    max_first_crawl_dt: dateWindow.max,
    sort_field: sortField,
    sort_type: sortType,
  };

  if (categoryId) queryParams.category_id = categoryId;
  if (search) queryParams.keyword = search;

  const response = await echotikRequest<
    EchotikApiResponse<EchotikProductListItem>
  >(PRODUCT_LIST_ENDPOINT, { params: queryParams });

  // API retorna code !== 0 para erros de negócio
  if (response.code !== 0) {
    throw new Error(
      `[echotik-products] API error ${response.code}: ${response.message}`,
    );
  }

  const rawItems = response.data ?? [];
  const items = rawItems.map(normalizeProductListItem);

  return {
    items,
    count: items.length,
    page,
    dateWindow,
  };
}
