/**
 * ShopCategory - Tipo para categorias do TikTok Shop / EchoTik
 *
 * Estrutura hierárquica com suporte a parent/child e path para exibição.
 */

export interface ShopCategory {
  /** ID único da categoria (string para consistência no frontend) */
  id: string;
  /** Nome da categoria */
  name: string;
  /** ID da categoria pai (null para categorias raiz) */
  parentId?: string | null;
  /** Caminho completo para exibição (ex: "Beleza > Maquiagem > Base") */
  path?: string;
  /** Nível na hierarquia (0 = raiz, 1 = subcategoria, etc.) */
  level?: number;
  /** Slug para URL (ex: "beleza-maquiagem-base") */
  slug?: string;
}

/**
 * Resposta da API de categorias
 */
export interface CategoriesResponse {
  categories: ShopCategory[];
  source: "echotik" | "database" | "mock";
  count: number;
  timestamp: string;
}
