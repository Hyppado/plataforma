/**
 * Centralized Categories Module
 *
 * Módulo centralizado para categorias do TikTok Shop.
 * As categorias são buscadas via API route (compatível com client components).
 */

// ====================
// TYPES
// ====================

export type Category = {
  id: string;
  name: string; // nome em inglês (original da API)
  namePt?: string; // tradução em português
  parentId?: string | null;
  level?: number;
  slug?: string;
  path?: string;
};

export const ALL_CATEGORY_ID = "all";

// ====================
// FETCH CATEGORIES (from DB with in-memory cache)
// ====================

let _categoriesCache: Category[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

/**
 * Retorna as categorias do TikTok Shop via API route.
 * Usa cache em memória de 10 min para evitar requests repetidos.
 * Compatível com client e server components.
 */
export async function fetchCategories(): Promise<Category[]> {
  const now = Date.now();

  if (_categoriesCache && now < _cacheExpiresAt) {
    return _categoriesCache;
  }

  try {
    const baseUrl =
      typeof window === "undefined"
        ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        : "";

    const res = await fetch(`${baseUrl}/api/echotik/categories`, {
      next: { revalidate: 600 }, // 10 min cache on server
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const categories: Category[] = data.categories ?? [];

    _categoriesCache = categories;
    _cacheExpiresAt = now + CACHE_TTL_MS;

    return categories;
  } catch (error) {
    console.error("[categories] Erro ao buscar categorias:", error);

    return [
      {
        id: ALL_CATEGORY_ID,
        name: "Todas as Categorias",
        level: 0,
        slug: "all",
      },
    ];
  }
}

/**
 * Limpa o cache em memória de categorias.
 * Chamado após sync do cron para forçar reload na próxima requisição.
 */
export function clearCategoriesCache(): void {
  _categoriesCache = null;
  _cacheExpiresAt = 0;
}

// ====================
// UTILITIES
// ====================

/**
 * Retorna categorias raiz (nível 1)
 */
export function getRootCategories(categories: Category[]): Category[] {
  return categories.filter((c) => c.level === 1);
}

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
