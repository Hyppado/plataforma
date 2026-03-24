/**
 * Definição dos rank fields disponíveis por entidade EchoTik.
 * Usados pelo cron (para saber quais buscar e salvar) e
 * pelas API routes + pages (para filtros de ordenação na UI).
 *
 * Referência: https://opendocs.echotik.live
 */

export interface RankFieldDef {
  /** Valor numérico esperado pelo parâmetro `*_rank_field` da API */
  field: number;
  /** Chave usada na URL (?sort=sales) */
  key: string;
  /** Rótulo exibido na UI */
  label: string;
}

/** Ordenações disponíveis para vídeos (video_rank_field) */
export const VIDEO_RANK_FIELDS: RankFieldDef[] = [
  { field: 2, key: "sales", label: "Mais vendidos" }, // 带货榜 — padrão
  { field: 1, key: "views", label: "Mais visualizados" }, // 热榜
];

/** Ordenações disponíveis para produtos (product_rank_field) */
export const PRODUCT_RANK_FIELDS: RankFieldDef[] = [
  { field: 1, key: "sales", label: "Mais vendidos" }, // padrão
  { field: 2, key: "gmv", label: "Maior receita" },
];

/** Ordenações disponíveis para criadores (influencer_rank_field) */
export const CREATOR_RANK_FIELDS: RankFieldDef[] = [
  { field: 2, key: "sales", label: "Mais vendidos" }, // padrão
  { field: 1, key: "followers", label: "Mais seguidores" },
];

/** Converte chave URL → field number para vídeos */
export function videoSortToField(sort: string | null | undefined): number {
  return (
    VIDEO_RANK_FIELDS.find((f) => f.key === sort)?.field ??
    VIDEO_RANK_FIELDS[0].field
  );
}

/** Converte chave URL → field number para produtos */
export function productSortToField(sort: string | null | undefined): number {
  return (
    PRODUCT_RANK_FIELDS.find((f) => f.key === sort)?.field ??
    PRODUCT_RANK_FIELDS[0].field
  );
}

/** Converte chave URL → field number para criadores */
export function creatorSortToField(sort: string | null | undefined): number {
  return (
    CREATOR_RANK_FIELDS.find((f) => f.key === sort)?.field ??
    CREATOR_RANK_FIELDS[0].field
  );
}
