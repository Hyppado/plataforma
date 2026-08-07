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

// ─── Orçamento de tempo (limite de execução da Vercel) ────────────
//
// A rota /api/cron/shopee declara maxDuration = 300s. O pipeline é sequencial
// e um único vídeo no pior caso custa ~230s (captions + download + Whisper
// 120s + GPT 30s + Shopee 15s + short link 15s). Sem orçamento explícito a
// função é morta pela plataforma no meio do lote.
//
// Estratégia: o lote para sozinho antes do limite e o próximo cron continua
// de onde parou (os vídeos já processados são pulados).

export const SHOPEE_BUDGET = {
  /** maxDuration declarado na rota do cron, em ms */
  FUNCTION_LIMIT_MS: 300_000,
  /**
   * Margem de segurança: tempo reservado para encerrar o IngestionRun e
   * devolver a resposta depois que o laço para.
   */
  SAFETY_MARGIN_MS: 30_000,
  /**
   * Custo estimado do pior caso de um vídeo. O laço só inicia mais um vídeo
   * se ainda houver esse tanto de orçamento — evita começar um Whisper de
   * 120s faltando 20s para o limite.
   */
  VIDEO_WORST_CASE_MS: 90_000,
  /**
   * Fatia máxima do orçamento gasta buscando a lista da hashtag. A paginação
   * (blocos de 20 + delay de 2s) pode sozinha levar ~40s para 400 vídeos.
   */
  DISCOVERY_BUDGET_MS: 60_000,
  /**
   * Cooldown antes de reprocessar um vídeo que falhou por motivo DEFINITIVO
   * (ex: GPT não identificou produto). Evita que os mesmos vídeos ruins
   * consumam todo o orçamento de todas as execuções.
   */
  FAILED_RETRY_COOLDOWN_MS: 24 * 60 * 60 * 1000,
  /**
   * Cooldown para falhas TRANSITÓRIAS do fornecedor (EchoTik 500 / risk
   * control, timeout de rede). Nesses casos o vídeo provavelmente é bom — só
   * pegamos a API num momento ruim.
   *
   * Já aconteceu em produção: dois cron seguidos esgotaram o rate limit da
   * EchoTik e 12 vídeos legítimos (125k a 3,1M views) foram marcados FAILED,
   * ficando 24h fora da fila. Uma hora é suficiente para o limiter reiniciar
   * sem transformar um soluço do fornecedor em um dia de conteúdo perdido.
   */
  TRANSIENT_RETRY_COOLDOWN_MS: 60 * 60 * 1000,
} as const;

/**
 * Prefixo que marca uma falha como transitória (culpa do fornecedor, não do
 * conteúdo). Gravado em `errorMessage` e lido por `filterUnprocessedVideos`
 * para escolher o cooldown.
 *
 * Usar o errorMessage evita uma migração só para adicionar um status novo, e
 * mantém o motivo legível no painel admin.
 */
export const TRANSIENT_ERROR_PREFIX = "[transitório]";

/** true se a falha registrada foi transitória (deve ser retentada logo). */
export function isTransientFailure(errorMessage: string | null): boolean {
  return !!errorMessage?.startsWith(TRANSIENT_ERROR_PREFIX);
}

/**
 * Orçamento útil do laço: limite da função menos a margem de segurança.
 */
export function achadinhosLoopBudgetMs(): number {
  return SHOPEE_BUDGET.FUNCTION_LIMIT_MS - SHOPEE_BUDGET.SAFETY_MARGIN_MS;
}

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