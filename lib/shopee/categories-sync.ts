/**
 * lib/shopee/categories-sync.ts — Sincroniza a taxonomia oficial da Shopee BR.
 *
 * POR QUE ISTO EXISTE
 * A Affiliate API devolve a categoria do produto apenas como IDs numéricos
 * (`productCatIds`: [L1, L2, L3]) e NÃO expõe query de categorias — confirmado
 * por introspecção do schema, que só tem shopOfferV2, shopeeOfferV2,
 * productOfferV2, conversionReport, validatedReport, partnerOrderReport,
 * listItemFeeds e getItemFeedData.
 *
 * Antes disto, os IDs eram traduzidos por um mapa de 26 entradas escrito à mão
 * que estava errado: afirmava que 100016 era "Beleza e Saúde/Perfumes" quando
 * é "Bolsas Femininas", e que 100630 era "Eletrônicos/Smartphones" quando é
 * "Beleza". Quando o ID não estava no mapa, a categoria era ADIVINHADA pela
 * palavra-chave da busca — daí o mesmo ID 100533 aparecer gravado ora como
 * "Moda e Acessórios", ora como "Eletrônicos".
 *
 * A fonte usada aqui é o guia de categorias do vendedor, que a própria
 * documentação da Affiliate API indica como referência para `productCatId`.
 * Ele devolve as folhas com o caminho completo (L1 > L2 > L3) e os nomes; os
 * níveis intermediários são derivados desse caminho.
 */

import { prisma } from "@/lib/prisma";
import type { Logger } from "@/lib/logger";

const BASE =
  "https://seller.shopee.com.br/help/api/v3/global_category/list/?locale=pt-br";

/** A API devolve no máximo 100 por página; `page`/`size` são os parâmetros. */
const PAGE_SIZE = 100;
const MAX_PAGES = 40;

interface CategoriaFolha {
  category_id: number;
  category_name: string;
  path: { category_id: number; category_name: string }[];
}

interface No {
  categoryId: number;
  name: string;
  level: number;
  parentId: number | null;
}

async function buscarPagina(page: number): Promise<CategoriaFolha[]> {
  const res = await fetch(`${BASE}&page=${page}&size=${PAGE_SIZE}`, {
    headers: {
      // Sem User-Agent de navegador o endpoint responde 403.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Accept: "application/json",
      Referer: "https://seller.shopee.com.br/edu/category-guide",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`categorias Shopee: HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: { global_cats?: CategoriaFolha[] };
  };
  return json.data?.global_cats ?? [];
}

/**
 * Expande as folhas no conjunto completo de nós.
 *
 * Cada folha traz o caminho inteiro, então L1 e L2 saem daí — não há endpoint
 * que os liste diretamente.
 */
export function expandirCaminhos(folhas: CategoriaFolha[]): No[] {
  const nos = new Map<number, No>();
  for (const folha of folhas) {
    folha.path?.forEach((p, i) => {
      if (!p?.category_id) return;
      nos.set(p.category_id, {
        categoryId: p.category_id,
        name: p.category_name,
        level: i + 1,
        parentId: i > 0 ? (folha.path[i - 1]?.category_id ?? null) : null,
      });
    });
  }
  return Array.from(nos.values());
}

export interface SyncCategoriasResult {
  folhas: number;
  nos: number;
  gravados: number;
}

/**
 * Baixa a taxonomia e grava em ShopeeCategory.
 *
 * Nunca apaga: categoria que sai do guia continua valendo para produtos
 * históricos já classificados com ela.
 */
export async function syncShopeeCategories(
  log: Logger,
): Promise<SyncCategoriasResult> {
  const folhas: CategoriaFolha[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const lote = await buscarPagina(page);
    folhas.push(...lote);
    if (lote.length < PAGE_SIZE) break;
  }

  const nos = expandirCaminhos(folhas);

  // Escopo vazio nunca deve virar escrita — sinaliza fonte fora do ar.
  if (nos.length === 0) {
    log.warn("Taxonomia da Shopee veio vazia — nada gravado");
    return { folhas: folhas.length, nos: 0, gravados: 0 };
  }

  let gravados = 0;
  for (const no of nos) {
    await prisma.shopeeCategory.upsert({
      where: { categoryId: no.categoryId },
      create: no,
      update: { name: no.name, level: no.level, parentId: no.parentId },
    });
    gravados++;
  }

  log.info("Taxonomia da Shopee sincronizada", {
    folhas: folhas.length,
    nos: nos.length,
    gravados,
  });
  return { folhas: folhas.length, nos: nos.length, gravados };
}

/** Idade máxima da dimensão antes de rebuscar. A taxonomia muda raramente. */
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sincroniza só se a dimensão estiver vazia ou vencida.
 *
 * Roda antes da ingestão do ranking: é esta tabela que traduz os
 * `productCatIds` do produto em nome. Vazia, os produtos entram sem categoria
 * e o filtro da tela fica cego.
 *
 * Falha aqui nunca interrompe o ranking — sem taxonomia nova, a anterior
 * continua servindo.
 */
export async function syncShopeeCategoriesIfStale(
  log: Logger,
  force = false,
): Promise<SyncCategoriasResult | null> {
  try {
    const maisRecente = await prisma.shopeeCategory.findFirst({
      orderBy: { syncedAt: "desc" },
      select: { syncedAt: true },
    });

    const vencida =
      !maisRecente || Date.now() - maisRecente.syncedAt.getTime() > VALIDADE_MS;
    if (!force && !vencida) return null;

    return await syncShopeeCategories(log);
  } catch (err) {
    log.warn("Sync de categorias falhou — seguindo com a dimensão atual", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
