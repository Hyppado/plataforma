/**
 * lib/shopee/types.ts
 *
 * Tipos compartilhados do módulo Shopee.
 * Centraliza definições para evitar duplicação e melhorar a manutenibilidade.
 */

// ─── EchoTik Video (vindo da API EchoTik) ─────────────────────────

export interface EchoTikVideoDTO {
  video_id: string;
  video_desc: string;
  cover_url?: string;
  video_url?: string;
  author_name?: string;
  /** Visualizações do vídeo (play_count da EchoTik) */
  views?: number;
}

// ─── Produto do Ranking ───────────────────────────────────────────

export interface ShopeeProductTrendInput {
  product_id?: string;
  product_name?: string;
  min_price?: number;
  max_price?: number;
  spu_avg_price?: number;
  product_commission_rate?: number;
  total_sale_cnt?: number;
  total_sale_gmv_amt?: number;
  shop_name?: string;
  cover_url?: string;
}

// ─── Constantes de configuração (valores padrão) ──────────────────

export const SHOPEE_DEFAULTS = {
  RANKING_LIMIT: 50,
  RANKING_FREQUENCY_HOURS: 24,
  ACHADINHOS_FREQUENCY_HOURS: 12,
  /** Quantidade de vídeos de achadinhos a buscar por execução do cron (20-200) */
  ACHADINHOS_COUNT: 50,
  /** Hashtag padrão para busca de achadinhos #achadinhosshopee (BR) */
  ACHADINHOS_HASHTAG_ID: "1696392324325382",
  /** Keyword/hashtag textual para discovery automático do ID no EchoTik */
  ACHADINHOS_KEYWORD: "achadinhosshopee",
  /** Região padrão para busca de achadinhos no EchoTik */
  ACHADINHOS_REGION: "BR",
} as const;

/**
 * Keywords usadas para popular o ranking de produtos da Shopee.
 * O ranking busca os mais vendidos (sortType: 2) de cada keyword
 * e consolida em uma lista única.
 */
export const RANKING_KEYWORDS = [
  "smartphone",
  "fone de ouvido",
  "perfume",
  "relógio",
  "tv",
  "notebook",
  "tablet",
  "cadeira",
  "tênis",
  "bolsa",
  "mouse",
  "teclado",
  "monitor",
  "fone bluetooth",
  "carregador",
  "película",
  "capa celular",
  "ventilador",
  "liquidificador",
  "cafeteira",
];

// ─── Prompt do GPT para extração de nome do produto ──────────────

export const GPT_PRODUCT_EXTRACTION_SYSTEM_PROMPT =
  "Você é um assistente preciso e focado que extrai apenas o nome do produto principal anunciado em descrições e transcrições de vídeos do TikTok de achadinhos da Shopee.";

/**
 * Monta o prompt de extração de produto enviado ao GPT.
 *
 * Contexto combinado: Descrição do post + Transcrição (Whisper/Captions).
 *
 * REGRAS ESTRITAS:
 * 1. DESCARTE TOTAL — Se NENHUM produto concreto for identificado na
 *    descrição ou transcrição, responda EXATAMENTE com a string "NULL".
 * 2. MÚLTIPLOS PRODUTOS — Se o vídeo for um compilado (ex: "Top 5 itens"),
 *    retorne APENAS o produto principal ou o PRIMEIRO produto mencionado.
 *    Nunca retorne uma lista.
 *
 * @param description - Descrição do post (video_desc da EchoTik)
 * @param transcript  - Transcrição limpa (Whisper ou Captions da EchoTik)
 */
export function buildProductExtractionPrompt(
  description: string,
  transcript: string,
): string {
  return `
Você é uma Inteligência Artificial especialista em e-commerce, SEO e mineração de produtos.
Sua tarefa é ler a DESCRIÇÃO e a TRANSCRIÇÃO de um vídeo do TikTok focado em "Achadinhos da Shopee"
e extrair UNICAMENTE o NOME DO PRODUTO principal, da forma mais GENÉRICA, CURTA e ALTAMENTE PESQUISÁVEL possível
para maximizar o match na busca da Shopee (SEO).

REGRAS CRÍTICAS:
1. SEO PARA SHOPEE: Retorne o nome do produto como se fosse uma busca na Shopee — genérico, curto e direto, limitando a 3 ou 4 palavras-chave (ex: "Mini Panqueca Elétrica", "Umidificador de Ar", "Cortador de Legumes 5 em 1"). Isso maximiza a taxa de conversão na busca.
2. REMOVA adjetivos, cores e descrições: Remova termos como "rosa", "fofo/a", "lindo/a", "incrível", "perfeito/a", "novo/a", "barato/a", "top", "melhor" e qualquer adjetivo de marketing. Exemplo: em vez de "mini panqueca elétrica rosa fofa", retorne apenas "mini panqueca elétrica".
3. DESCARTE TOTAL (NULL): Se você NÃO conseguir identificar NENHUM produto concreto na descrição ou na transcrição (ex: vídeo apenas com dicas, unboxing sem nome, música, fala vaga sem produto), responda EXATAMENTE com a string "NULL".
4. MÚLTIPLOS PRODUTOS (compilados): Se o vídeo for um compilado (ex: "Top 5 itens da Shopee", "3 produtos que comprei"), retorne APENAS o PRODUTO PRINCIPAL ou o PRIMEIRO produto mencionado. NUNCA retorne uma lista ou múltiplos nomes.
5. Não inclua hashtags, links, preços, gírias ou saudações.
6. Responda APENAS com o nome do produto (uma única linha, 3-4 palavras), ou "NULL" quando aplicável. Sem introdução, sem explicações, sem formatação Markdown adicionais.

Descrição do vídeo:
"${description}"

Transcrição do vídeo:
"${transcript}"
`;
}

// ─── Fallback de link quando a API Shopee falha ──────────────────

export function buildShopeeSearchFallbackLink(productName: string): string {
  const encodedName = encodeURIComponent(productName);
  return `https://shopee.com.br/search?keyword=${encodedName}`;
}