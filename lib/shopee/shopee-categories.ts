/**
 * lib/shopee/shopee-categories.ts
 *
 * Estrutura de categorias da Shopee para o filtro de dropdown.
 *
 * A Shopee Affiliate API retorna apenas IDs numéricos de categoria (productCatIds[]).
 * Este módulo:
 * 1. Mapeia IDs conhecidos → nomes legíveis (categoria pai + subcategoria)
 * 2. Fornece fallback baseado na keyword de busca quando os IDs são desconhecidos
 * 3. Agrupa dinamicamente os produtos do ranking em uma árvore
 *    [{ parent: '...', children: ['...', '...'] }] para o dropdown
 */

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

// ─── Mapa de categorias conhecidas da Shopee BR ──────────────────
// IDs vêm do campo productCatIds da API productOfferV2.
// [0] = categoria L1 (pai), [1] = categoria L2 (subcategoria).

const SHOPEE_CATEGORY_MAP: Record<string, { parent: string; child?: string }> = {
  // Eletrônicos / Áudio
  "100630": { parent: "Eletrônicos", child: "Smartphones" },
  "100632": { parent: "Eletrônicos", child: "Fones e Áudio" },
  "100633": { parent: "Eletrônicos", child: "Tablets" },
  "100634": { parent: "Eletrônicos", child: "Computadores e Notebooks" },
  "100635": { parent: "Eletrônicos", child: "Monitores" },
  "100636": { parent: "Eletrônicos", child: "Periféricos" },
  "100637": { parent: "Eletrônicos", child: "Carregadores e Cabos" },
  "100638": { parent: "Eletrônicos", child: "Acessórios para Celular" },

  // Casa e Decoração
  "100006": { parent: "Casa e Decoração", child: "Eletrodomésticos" },
  "100007": { parent: "Casa e Decoração", child: "Utilidades Domésticas" },
  "100009": { parent: "Casa e Decoração", child: "Móveis" },
  "100010": { parent: "Casa e Decoração", child: "Organização" },

  // Moda e Acessórios
  "100012": { parent: "Moda e Acessórios", child: "Roupas" },
  "100013": { parent: "Moda e Acessórios", child: "Calçados" },
  "100014": { parent: "Moda e Acessórios", child: "Bolsas e Mochilas" },
  "100015": { parent: "Moda e Acessórios", child: "Relógios e Acessórios" },

  // Beleza e Saúde
  "100016": { parent: "Beleza e Saúde", child: "Perfumes" },
  "100017": { parent: "Beleza e Saúde", child: "Cuidados com a Pele" },
  "100018": { parent: "Beleza e Saúde", child: "Cabelos" },
  "100019": { parent: "Beleza e Saúde", child: "Maquiagem" },

  // Esportes e Lazer
  "100020": { parent: "Esportes e Lazer", child: "Fitness e Musculação" },
  "100021": { parent: "Esportes e Lazer", child: "Corrida e Caminhada" },

  // Automotivo
  "100022": { parent: "Automotivo e Motocicletas", child: "Carro" },
  "100023": { parent: "Automotivo e Motocicletas", child: "Motos" },
  "100024": { parent: "Automotivo e Motocicletas", child: "Peças e Acessórios" },
};

// Fallback de subcategoria por keyword (quando a API não retorna IDs conhecidos)
const KEYWORD_CATEGORY_FALLBACK: Record<string, { parent: string; child: string }> = {
  smartphone: { parent: "Eletrônicos", child: "Smartphones" },
  "fone de ouvido": { parent: "Eletrônicos", child: "Fones e Áudio" },
  "fone bluetooth": { parent: "Eletrônicos", child: "Fones e Áudio" },
  perfume: { parent: "Beleza e Saúde", child: "Perfumes" },
  "relógio": { parent: "Moda e Acessórios", child: "Relógios e Acessórios" },
  tv: { parent: "Eletrônicos", child: "TVs" },
  notebook: { parent: "Eletrônicos", child: "Computadores e Notebooks" },
  tablet: { parent: "Eletrônicos", child: "Tablets" },
  cadeira: { parent: "Casa e Decoração", child: "Móveis" },
  "tênis": { parent: "Moda e Acessórios", child: "Calçados" },
  bolsa: { parent: "Moda e Acessórios", child: "Bolsas e Mochilas" },
  mouse: { parent: "Eletrônicos", child: "Periféricos" },
  teclado: { parent: "Eletrônicos", child: "Periféricos" },
  monitor: { parent: "Eletrônicos", child: "Monitores" },
  carregador: { parent: "Eletrônicos", child: "Carregadores e Cabos" },
  "película": { parent: "Eletrônicos", child: "Acessórios para Celular" },
  "capa celular": { parent: "Eletrônicos", child: "Acessórios para Celular" },
  ventilador: { parent: "Casa e Decoração", child: "Eletrodomésticos" },
  liquidificador: { parent: "Casa e Decoração", child: "Eletrodomésticos" },
  cafeteira: { parent: "Casa e Decoração", child: "Eletrodomésticos" },
};

/**
 * Normaliza uma string para ser usada como chave de fallback.
 */
function normalizeKey(keyword: string): string {
  return keyword.trim().toLowerCase();
}

/**
 * Resolve a categoria a partir de um texto livre.
 *
 * O ranking passa uma das RANKING_KEYWORDS (casa exato). Os achadinhos passam
 * o nome do produto extraído pelo GPT (ex: "fone de ouvido bluetooth gamer"),
 * que nunca casa exatamente com as chaves do mapa — por isso a segunda passada
 * por substring.
 *
 * As chaves são testadas da mais longa para a mais curta para que a
 * correspondência mais específica vença (ex: "fone de ouvido" antes de "fone
 * bluetooth" quando o texto contém ambas).
 *
 * @param text - Keyword de busca ou nome do produto
 * @returns Categoria pai + subcategoria, ou null se nada casar
 */
export function resolveCategoryFromText(
  text: string,
): { parent: string; child: string } | null {
  const normalized = normalizeKey(text ?? "");
  if (!normalized) return null;

  // 1. Correspondência exata (comportamento original do ranking)
  const exact = KEYWORD_CATEGORY_FALLBACK[normalized];
  if (exact) return exact;

  // 2. Correspondência por substring, da chave mais longa para a mais curta
  const keys = Object.keys(KEYWORD_CATEGORY_FALLBACK).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of keys) {
    if (normalized.includes(key)) return KEYWORD_CATEGORY_FALLBACK[key];
  }

  return null;
}

/**
 * Mapeia os IDs de categoria da Shopee (productCatIds[]) para nomes legíveis.
 * Usa o mapa de IDs conhecidos ou fallback da keyword de busca.
 *
 * @param catIds - IDs numéricos da categoria vindos da API (productCatIds)
 * @param keyword - Keyword de busca que originou o produto (fallback)
 */
export function mapShopeeCategories(
  catIds: number[],
  keyword: string,
): ProductCategoryInfo {
  const catIdStr = catIds?.[0] != null ? String(catIds[0]) : null;
  const subCatIdStr = catIds?.[1] != null ? String(catIds[1]) : null;

  // 1. Tenta resolver pelo ID conhecido da categoria L1
  if (catIdStr && SHOPEE_CATEGORY_MAP[catIdStr]) {
    const mapped = SHOPEE_CATEGORY_MAP[catIdStr];
    return {
      categoryId: catIdStr,
      subCategoryId: subCatIdStr,
      categoryName: mapped.parent,
      subCategoryName: mapped.child ?? subCatIdStr ?? null,
    };
  }

  // 2. Fallback: usa a keyword de busca (ou o nome do produto) para inferir
  const fallback = resolveCategoryFromText(keyword);
  if (fallback) {
    return {
      categoryId: catIdStr,
      subCategoryId: subCatIdStr,
      categoryName: fallback.parent,
      subCategoryName: fallback.child,
    };
  }

  // 3. Sem categoria conhecida
  return {
    categoryId: catIdStr,
    subCategoryId: subCatIdStr,
    categoryName: null,
    subCategoryName: null,
  };
}

/**
 * Agrupa produtos do ranking Shopee em uma árvore de categorias dinâmica.
 *
 * A API da Shopee não envia uma lista de categorias pronta; portanto,
 * derivamos a árvore dos próprios produtos disponíveis.
 *
 * @param products - Produtos do ranking Shopee
 * @returns Array estruturado: [{ parent: 'Eletrônicos', children: ['Fones', 'Monitores'] }]
 */
export function buildShopeeCategoryTree(
  products: Array<{
    categoryName?: string | null;
    subCategoryName?: string | null;
  }>,
): ShopeeCategoryNode[] {
  const parents = new Map<string, Set<string>>();

  for (const p of products) {
    const parent = p.categoryName?.trim();
    if (!parent) continue;

    if (!parents.has(parent)) {
      parents.set(parent, new Set());
    }

    const child = p.subCategoryName?.trim();
    if (child) {
      parents.get(parent)!.add(child);
    }
  }

  return Array.from(parents.entries())
    .map(([parent, childrenSet]) => ({
      parent,
      children: Array.from(childrenSet).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.parent.localeCompare(b.parent));
}

/**
 * Verifica se um produto corresponde a uma seleção de categoria.
 *
 * @param product - Produto com categoryName/subCategoryName
 * @param selectedCategory - Seleção: "" (todas), parent, ou parent::child
 */
export function matchesShopeeCategory(
  product: {
    categoryName?: string | null;
    subCategoryName?: string | null;
  },
  selectedCategory: string,
): boolean {
  if (!selectedCategory) return true;

  // Formato composto "parent::child" para subcategoria
  if (selectedCategory.includes("::")) {
    const [parent, child] = selectedCategory.split("::");
    return (
      product.categoryName === parent && product.subCategoryName === child
    );
  }

  // Categoria pai inteira
  return product.categoryName === selectedCategory;
}