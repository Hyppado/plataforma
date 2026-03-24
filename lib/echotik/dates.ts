/**
 * Echotik date helpers
 *
 * A API Product List da Echotik espera datas no formato compacto `yyyyMMdd`
 * (ex: 20260324) nos parâmetros `min_first_crawl_dt` e `max_first_crawl_dt`.
 *
 * Este módulo fornece funções utilitárias para gerar esse formato e calcular
 * a janela de datas para "produtos novos" (últimos N dias, padrão 3).
 *
 * Todas as datas usam **UTC** para evitar variação por timezone do servidor.
 */

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

/**
 * Formata uma Date no padrão compacto `yyyyMMdd` (UTC).
 *
 * @example toCompactDate(new Date("2026-03-24T12:00:00Z")) → "20260324"
 */
export function toCompactDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// ---------------------------------------------------------------------------
// Janela de "novos produtos"
// ---------------------------------------------------------------------------

export interface DateWindow {
  /** Data mínima no formato `yyyyMMdd` (inclusive) */
  min: string;
  /** Data máxima no formato `yyyyMMdd` (inclusive) */
  max: string;
}

/**
 * Calcula a janela de "produtos novos" — itens cuja `first_crawl_dt`
 * esteja entre `(hoje − daysBack)` e `hoje`, inclusive.
 *
 * @param daysBack  Número de dias para trás (padrão 3).
 * @param now       Data de referência (padrão `new Date()`). Útil para testes.
 *
 * @example
 * // Supondo hoje = 2026-03-24 (UTC)
 * newProductDateWindow()
 * // → { min: "20260321", max: "20260324" }
 *
 * newProductDateWindow(7)
 * // → { min: "20260317", max: "20260324" }
 */
export function newProductDateWindow(
  daysBack = 3,
  now: Date = new Date(),
): DateWindow {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - daysBack);

  return {
    min: toCompactDate(from),
    max: toCompactDate(today),
  };
}
