/**
 * lib/echotik/cron/types.ts — API response interfaces and config constants
 *
 * Shared types used by all sync modules.
 */

// ---------------------------------------------------------------------------
// Sync intervals (hours)
// ---------------------------------------------------------------------------

/** Categorias L1 → 1×/dia */
export const CATEGORIES_INTERVAL_HOURS = 24;

/** Categorias L2/L3 → 1×/semana */
export const CATEGORIES_L2L3_INTERVAL_HOURS = 168;

/** Vídeos trending → 1×/dia */
export const VIDEO_TREND_INTERVAL_HOURS = 24;

/** Produtos trending → 1×/dia */
export const PRODUCT_TREND_INTERVAL_HOURS = 24;

/** Creators trending → 1×/dia */
export const CREATOR_TREND_INTERVAL_HOURS = 24;

/** Páginas por ranklist (page_size=10 cada) */
export const VIDEO_RANKLIST_PAGES = 10;
export const PRODUCT_RANKLIST_PAGES = 10;
export const CREATOR_RANKLIST_PAGES = 10;

/** Batch size para product/detail */
export const PRODUCT_DETAIL_BATCH_SIZE = 5;

/** Idade máxima (dias) antes de re-buscar detalhes do produto */
export const PRODUCT_DETAIL_MAX_AGE_DAYS = 7;

// ---------------------------------------------------------------------------
// API response types (EchoTik v3)
// ---------------------------------------------------------------------------

/** Resposta genérica da API EchoTik v3 */
export interface EchotikApiResponse<T> {
  code: number;
  message: string;
  data: T[];
  requestId: string;
}

/** Item de categoria L1/L2/L3 */
export interface EchotikCategoryItem {
  category_id: string;
  category_level: string;
  category_name: string;
  language: string;
  parent_id: string;
  [key: string]: unknown;
}

/** Item do vídeo ranklist */
export interface EchotikVideoRankItem {
  video_id: string;
  video_desc: string;
  nick_name: string;
  unique_id: string;
  user_id: string;
  avatar: string;
  category: string;
  create_time: string;
  created_by_ai: string;
  duration: number;
  product_category_list: string;
  reflow_cover: string;
  region: string;
  sales_flag: number;
  total_comments_cnt: number;
  total_digg_cnt: number;
  total_favorites_cnt: number;
  total_shares_cnt: number;
  total_video_sale_cnt: number;
  total_video_sale_gmv_amt: number;
  total_views_cnt: number;
  video_products: string;
  [key: string]: unknown;
}

/** Item do product ranklist */
export interface EchotikProductRankItem {
  product_id: string;
  product_name: string;
  category_id: string;
  category_l2_id: string;
  category_l3_id: string;
  min_price: number;
  max_price: number;
  spu_avg_price: number;
  product_commission_rate: number;
  total_sale_cnt: number;
  total_sale_gmv_amt: number;
  total_ifl_cnt: number;
  total_video_cnt: number;
  total_live_cnt: number;
  region: string;
  [key: string]: unknown;
}

/** Item do influencer ranklist */
export interface EchotikInfluencerRankItem {
  user_id: string;
  unique_id: string;
  nick_name: string;
  avatar: string;
  category: string;
  ec_score: number;
  total_followers_cnt: number;
  total_followers_history_cnt: number;
  total_sale_cnt: number;
  total_sale_gmv_amt: number;
  total_sale_history_cnt: number;
  total_sale_gmv_history_amt: number;
  total_digg_cnt: number;
  total_digg_history_cnt: number;
  total_product_cnt: number;
  total_product_history_cnt: number;
  total_video_cnt: number;
  total_post_video_cnt: number;
  total_live_cnt: number;
  most_category_id: string;
  most_category_l2_id: string;
  most_category_l3_id: string;
  product_category_list: string;
  region: string;
  sales_flag: number;
  [key: string]: unknown;
}

/** Item de product/detail */
export interface EchotikProductDetailItem {
  product_id: string;
  product_name: string;
  cover_url: string;
  spu_avg_price: number;
  min_price: number;
  max_price: number;
  product_rating: number;
  product_commission_rate: number;
  category_id: string;
  region: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Cron result
// ---------------------------------------------------------------------------

export interface CronStats {
  categoriesSynced: number;
  videosSynced: number;
  productsSynced: number;
  creatorsSynced: number;
  productDetailsEnriched: number;
  categoriesSkipped: boolean;
  videosSkipped: boolean;
  productsSkipped: boolean;
  creatorsSkipped: boolean;
  durationMs: number;
}

export interface CronResult {
  runId: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  stats: CronStats;
  error?: string;
}
