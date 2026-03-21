/**
 * Centralized Categories Module
 *
 * Módulo centralizado para buscar e gerenciar categorias do TikTok Shop.
 * - Busca via API interna que lê do banco de dados (sincronizado pelo cron)
 * - Cache em memória no client
 * - Utilitário pickCategoryByHash para atribuição determinística
 */

// ====================
// TYPES
// ====================

export type Category = {
  id: string;
  name: string;
  parentId?: string | null;
  level?: number;
  slug?: string;
  path?: string;
};

export const ALL_CATEGORY_ID = "all";

// ====================
// CLIENT-SIDE CACHE
// ====================

let cachedCategories: Category[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

/** Categoria mínima retornada quando o banco ainda não tem dados */
const EMPTY_FALLBACK: Category[] = [
  { id: ALL_CATEGORY_ID, name: "Todas as Categorias", level: 0, slug: "all" },
];

// ====================
// FETCH CATEGORIES
// ====================

/**
 * Busca categorias do TikTok Shop via API interna (que lê do banco).
 * Usa cache em memória e retorna "Todas" caso o banco ainda esteja vazio.
 *
 * @returns Lista flat de categorias, sempre começando com "Todas"
 */
export async function fetchCategories(): Promise<Category[]> {
  // Verificar cache válido
  const now = Date.now();
  if (cachedCategories && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedCategories;
  }

  try {
    const res = await fetch("/api/echotik/categories", {
      cache: "force-cache",
    });

    if (!res.ok) {
      console.warn("[categories] API retornou erro, usando cache/fallback");
      return cachedCategories ?? EMPTY_FALLBACK;
    }

    const data = await res.json();
    const categories: Category[] = data.categories || [];

    // Se banco vazio (só "Todas"), retornar e não cachear por muito tempo
    if (categories.length <= 1) {
      console.warn("[categories] Banco sem categorias — aguardando cron");
      cachedCategories = EMPTY_FALLBACK;
      cacheTimestamp = now - CACHE_TTL_MS + 5 * 60 * 1000; // cachear só 5 min
      return EMPTY_FALLBACK;
    }

    // Garantir que "Todas" está no início
    const hasAll = categories.some((c) => c.id === ALL_CATEGORY_ID);
    if (!hasAll) {
      categories.unshift({
        id: ALL_CATEGORY_ID,
        name: "Todas as Categorias",
        level: 0,
        slug: "all",
      });
    }

    cachedCategories = categories;
    cacheTimestamp = now;
    return categories;
  } catch (error) {
    console.warn("[categories] Erro no fetch, usando cache/fallback:", error);
    return cachedCategories ?? EMPTY_FALLBACK;
  }
}

// ====================
// UTILITIES
// ====================

/**
 * Atribui uma categoria de forma determinística baseado no ID do item.
 * Usa hash simples para garantir que o mesmo ID sempre retorna a mesma categoria.
 *
 * @param id - ID do item (video, product, etc)
 * @param categories - Lista de categorias disponíveis
 * @returns ID da categoria atribuída (exclui "all")
 */
export function pickCategoryByHash(id: string, categories: Category[]): string {
  // Filtrar categorias reais (excluir "all" e preferir level > 0)
  const validCategories = categories.filter(
    (c) => c.id !== ALL_CATEGORY_ID && (c.level === undefined || c.level >= 1),
  );

  // Se não houver categorias válidas, usar todas exceto "all"
  const pool =
    validCategories.length > 0
      ? validCategories
      : categories.filter((c) => c.id !== ALL_CATEGORY_ID);

  if (pool.length === 0) return "outros";

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % pool.length;
  return pool[index].id;
}

/**
 * Encontra categoria por ID ou slug
 */
export function getCategoryById(
  id: string,
  categories: Category[],
): Category | undefined {
  return categories.find((c) => c.id === id || c.slug === id);
}

/**
 * Retorna categorias raiz (level 0)
 */
export function getRootCategories(categories: Category[]): Category[] {
  return categories.filter((c) => c.level === 0 || !c.parentId);
}

/**
 * Retorna subcategorias de um parent
 */
export function getSubcategories(
  parentId: string,
  categories: Category[],
): Category[] {
  return categories.filter((c) => c.parentId === parentId);
}

/**
 * Verifica se item pertence a uma categoria (incluindo subcategorias)
 */
export function matchesCategory(
  itemCategoryId: string | undefined,
  filterCategoryId: string,
  categories: Category[],
): boolean {
  if (!filterCategoryId || filterCategoryId === ALL_CATEGORY_ID) return true;
  if (!itemCategoryId) return false;

  // Match direto
  if (itemCategoryId === filterCategoryId) return true;

  // Verificar se é subcategoria
  const itemCategory = getCategoryById(itemCategoryId, categories);
  if (itemCategory?.parentId === filterCategoryId) return true;

  // Verificar ancestrais
  let current = itemCategory;
  while (current?.parentId) {
    if (current.parentId === filterCategoryId) return true;
    current = getCategoryById(current.parentId, categories);
  }

  return false;
}

/**
 * Limpa o cache de categorias (útil para testes ou refresh forçado)
 */
export function clearCategoriesCache(): void {
  cachedCategories = null;
  cacheTimestamp = 0;
}
