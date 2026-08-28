/**
 * lib/shopee/shopee-categories.ts
 *
 * Tradução dos IDs de categoria da Shopee em nomes exibíveis.
 *
 * A Affiliate API devolve a categoria do produto no próprio objeto, como
 * `productCatIds: [L1, L2, L3]` (0 quando o nível não existe). Esse é o campo
 * correto e autoritativo — nada precisa ser inferido.
 *
 * O QUE ESTAVA ERRADO
 * Este módulo traduzia os IDs por um mapa de 26 entradas escrito à mão que não
 * veio de fonte nenhuma, e que estava incorreto na maioria das entradas:
 *
 *     ID       o mapa dizia                    a Shopee diz
 *     100016   Beleza e Saúde › Perfumes       Bolsas Femininas
 *     100630   Eletrônicos › Smartphones       Beleza
 *     100013   Moda › Calçados                 Celulares e Dispositivos
 *     100636   Eletrônicos › Periféricos       Casa e Decoração
 *
 * Era por isso que filtrar "Beleza e Saúde" trazia bolsas.
 *
 * Pior: quando o ID não estava no mapa (6 dos 19 em uso), a categoria era
 * ADIVINHADA pela palavra-chave que encontrou o produto. Como o mesmo produto
 * pode ser achado por buscas diferentes, o ID 100533 chegou a ficar gravado
 * ora como "Moda e Acessórios", ora como "Eletrônicos" — o nome não descrevia
 * o produto, descrevia a busca.
 *
 * Agora a tradução vem da tabela ShopeeCategory, alimentada pela taxonomia
 * oficial (ver lib/shopee/categories-sync.ts).
 */

import { prisma } from "@/lib/prisma";

// ─── Tipos ──────────────────────────────────────────────────────

export interface ShopeeCategoryNode {
  parent: string;
  children: string[];
}

export interface ProductCategoryInfo {
  categoryId: string | null;
  subCategoryId: string | null;
  categoryName: string | null;
  subCategoryName: string | null;
}

// ─── Cache do processo ──────────────────────────────────────────
// A dimensão tem ~1700 linhas e muda raramente; carregá-la a cada produto
// desperdiçaria uma consulta por item durante a ingestão.

let cache: Map<number, string> | null = null;
let cacheEm = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function carregarDimensao(): Promise<Map<number, string>> {
  if (cache && Date.now() - cacheEm < CACHE_TTL_MS) return cache;

  const linhas = await prisma.shopeeCategory.findMany({
    select: { categoryId: true, name: true },
  });
  cache = new Map(linhas.map((l) => [l.categoryId, l.name]));
  cacheEm = Date.now();
  return cache;
}

/** Descarta o cache — usar após sincronizar a taxonomia. */
export function invalidarCacheCategorias(): void {
  cache = null;
}

/**
 * Traduz `productCatIds` em nomes, consultando a dimensão oficial.
 *
 * ID desconhecido devolve nome nulo em vez de um palpite: card sem categoria é
 * melhor do que card na categoria errada, e o nulo é visível na auditoria.
 *
 * @param catIds - productCatIds da Affiliate API: [L1, L2, L3]
 */
export async function mapShopeeCategories(
  catIds: number[] | null | undefined,
): Promise<ProductCategoryInfo> {
  const dim = await carregarDimensao();

  const l1 = catIds?.[0] && catIds[0] !== 0 ? catIds[0] : null;
  const l2 = catIds?.[1] && catIds[1] !== 0 ? catIds[1] : null;

  return {
    categoryId: l1 != null ? String(l1) : null,
    subCategoryId: l2 != null ? String(l2) : null,
    categoryName: l1 != null ? (dim.get(l1) ?? null) : null,
    subCategoryName: l2 != null ? (dim.get(l2) ?? null) : null,
  };
}

/**
 * Árvore de categorias para o dropdown, vinda da dimensão.
 *
 * Antes a árvore era derivada dos produtos carregados na tela, então o filtro
 * só oferecia as categorias que por acaso estavam nos 100 primeiros — quatro,
 * das 27 que a Shopee tem.
 *
 * @param apenasComProdutos - IDs L1 presentes no conjunto atual. Quando
 *   informado, limita o dropdown ao que de fato tem resultado.
 */
export async function buildShopeeCategoryTree(
  apenasComProdutos?: Set<string>,
): Promise<ShopeeCategoryNode[]> {
  const [pais, filhos] = await Promise.all([
    prisma.shopeeCategory.findMany({
      where: { level: 1 },
      select: { categoryId: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.shopeeCategory.findMany({
      where: { level: 2 },
      select: { name: true, parentId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const porPai = new Map<number, string[]>();
  for (const f of filhos) {
    if (f.parentId == null) continue;
    if (!porPai.has(f.parentId)) porPai.set(f.parentId, []);
    porPai.get(f.parentId)!.push(f.name);
  }

  return pais
    .filter(
      (p) => !apenasComProdutos || apenasComProdutos.has(String(p.categoryId)),
    )
    .map((p) => ({
      parent: p.name,
      children: porPai.get(p.categoryId) ?? [],
    }));
}

/**
 * Verifica se um produto pertence à categoria selecionada.
 *
 * A comparação é pelo nome porque é o nome que o dropdown carrega. Isso só é
 * seguro porque os nomes passaram a vir da dimensão oficial: os 27 nomes de L1
 * são únicos, e a seleção de subcategoria usa a forma composta "pai::filho",
 * que desambigua um mesmo nome de L2 aparecendo sob pais diferentes.
 *
 * O que quebrava antes não era comparar por nome — era o nome estar errado,
 * vindo de um mapa incorreto ou adivinhado pela palavra-chave da busca.
 *
 * @param selectedCategory - "" (todas), "<nomeL1>", ou "<nomeL1>::<nomeL2>"
 */
export function matchesShopeeCategory(
  product: { categoryName?: string | null; subCategoryName?: string | null },
  selectedCategory: string,
): boolean {
  if (!selectedCategory) return true;

  if (selectedCategory.includes("::")) {
    const [pai, filho] = selectedCategory.split("::");
    return product.categoryName === pai && product.subCategoryName === filho;
  }

  return product.categoryName === selectedCategory;
}
