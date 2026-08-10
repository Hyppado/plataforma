/**
 * lib/shopee/pipeline.ts
 *
 * Pipeline de IA para ingestão de produtos "Achadinhos Shopee".
 *
 * NOVA ARQUITETURA — Foco em Velocidade + Robustez:
 * 1. EchoTik → busca vídeos com tag #achadinhosshopee
 *    - Paginação SEGURA: blocos de no máximo count=20 com offset,
 *      delay de ~2s entre chamadas para evitar Erro 500 (Risk Control)
 *    - Dedup por video_id para não processar o mesmo vídeo 2x
 * 2. Transcrição com FALLBACK:
 *    - Tenta EchoTik Captions (legenda nativa — rápido e gratuito)
 *    - Se falhar/não houver → tenta Whisper via download do vídeo
 * 3. Fast-Fail (Whisper):
 *    - A requisição de download-url da EchoTik tem no máx 1-2 retries
 *      com delay curto (~1s)
 *    - Se a EchoTik bloquear o download (Erro 500 / risk control),
 *      aplica `continue` imediatamente e pula para o próximo vídeo
 *    - NUNCA trava o cron esperando backoff exponencial longo
 * 4. OpenAI GPT → extrai o nome do produto da transcrição
 *    - Se a IA não achar um produto válido → continue (pula o vídeo)
 * 5. Shopee Affiliate API → busca o produto real pelo nome
 *    - Filtro rigoroso: vendas <= 0 ou preço <= 0 → ignore
 *    - generateShortLink em try/catch — se falhar, usa originUrl
 * 6. Merge rigoroso de dados:
 *    - Echotik: views (play_count) e tiktokVideoUrl (URL canônica)
 *    - Shopee: price, sales, commission, shopeeAffiliateUrl
 * 7. Salva em ShopeeAchadinhoProduct com status PENDING (admin aprova)
 *
 * ORÇAMENTO DE TEMPO (limite de execução da Vercel):
 * O lote roda em série dentro de um orçamento (`processAchadinhosBatch`) e
 * persiste CADA vídeo antes de passar ao próximo. Se o orçamento acabar, ele
 * encerra limpo com `partial: true` e a próxima execução do cron continua de
 * onde parou — vídeos já processados são pulados. Nunca há trabalho pago
 * (Whisper/GPT) perdido por a função ter sido morta pela plataforma.
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { parseCaptionToPlainText } from "@/lib/transcription/media";
import { getVideoCaptions } from "@/lib/transcription/media";
import { getVideoDownloadUrl, downloadVideoBuffer } from "@/lib/transcription/media";
import { transcribeWithWhisper, isWhisperError } from "@/lib/transcription/whisper";
import { getSecretSetting, getSetting, SETTING_KEYS } from "@/lib/settings";
import { findBestShopeeOffer } from "@/lib/shopee/shopee-api-client";
import {
  type EchoTikVideoDTO,
  GPT_PRODUCT_EXTRACTION_SYSTEM_PROMPT,
  buildProductExtractionPrompt,
  buildShopeeSearchFallbackLink,
  SHOPEE_DEFAULTS,
  SHOPEE_BUDGET,
  ACHADINHOS_MAX_HASHTAGS,
  achadinhosLoopBudgetMs,
  TRANSIENT_ERROR_PREFIX,
  isTransientFailure,
  tiktokVideoCreatedAt,
} from "@/lib/shopee/types";
import {
  fetchVideosByHashtag,
  type EchotikHashtagVideoItem,
} from "@/lib/echotik/client";
import {
  mapAwemeListToVideos,
  getAchadinhosHashtagIds,
  parseViewsFromEchoTikItem,
} from "@/lib/shopee/client";
import { mapShopeeCategories } from "@/lib/shopee/shopee-categories";
import { uploadImageToBlob } from "@/lib/storage/blob";

const log = createLogger("shopee/pipeline");

// ─── Constantes de paginação segura (Echotik Risk Control) ────────────────

/** Bloco máximo seguro por chamada à API da EchoTik */
const ECHOTIK_PAGE_SIZE = 20;
/** Delay entre chamadas paginadas (~2s) para não estourar risk control */
const ECHOTIK_PAGE_DELAY_MS = 2_000;
/** Limite mínimo/máximo suportado pelo admin (20-400) */
const ACHADINHOS_MIN_COUNT = 20;
const ACHADINHOS_MAX_COUNT = 400;

/** Sleep helper para delays controlados */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Constrói a URL canônica oficial do TikTok (tiktokVideoUrl).
 * Ex: https://www.tiktok.com/@handle/video/1234567890
 *
 * Usada exclusivamente para o embed/player do TikTok no frontend.
 */
export function buildCanonicalTikTokUrl(
  videoId: string,
  authorName?: string | null,
): string {
  const handle = authorName?.replace(/^@/, "") || "user";
  return `https://www.tiktok.com/@${handle}/video/${videoId}`;
}

/**
 * Extrai o nome do produto de uma legenda usando OpenAI GPT.
 *
 * Contexto combinado: Descrição do post + Transcrição (Whisper/Captions).
 *
 * Validação estrita:
 * - Se o GPT retornar "NULL" (nenhum produto identificado) → retorna null
 * - Se o GPT retornar múltiplos nomes (lista) → desconsidera e retorna null
 *
 * @param description - Descrição do post (video_desc da EchoTik)
 * @param transcript - Texto da transcrição (EchoTik Captions ou Whisper)
 * @returns Nome limpo do produto principal, ou null se nada válido
 */
export async function extractProductName(
  description: string,
  transcript: string,
): Promise<string | null> {
  const apiKey = await getSecretSetting(SETTING_KEYS.OPENAI_API_KEY);
  if (!apiKey) {
    log.error("OpenAI API key não configurada para extração Shopee");
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: GPT_PRODUCT_EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: buildProductExtractionPrompt(description, transcript) },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      log.error(`OpenAI API retornou erro ${response.status}: ${await response.text()}`);
      return null;
    }

    const data = await response.json();
    const resultText: string | undefined = data.choices?.[0]?.message?.content?.trim();
    if (!resultText) return null;

    // Remove aspas e pontuação residual
    const cleanName = resultText
      .replace(/^["']|["']$/g, "")
      .replace(/\.$/, "")
      .trim();

    // DESCARTE TOTAL: o GPT foi instruído a retornar EXATAMENTE "NULL"
    // quando não identifica nenhum produto concreto. Se recebermos isso,
    // aplicamos continue imediato (retorna null para o caller).
    if (/^null$/i.test(cleanName)) {
      log.info(`GPT retornou NULL (nenhum produto identificado) — descartando`);
      return null;
    }

    // Validação rigorosa: se o resultado for vazio, genérico demais
    // ou não parecer um nome de produto, retorna null.
    if (!cleanName || cleanName.length < 3) return null;

    // Rejeita respostas que não sejam um nome de produto real
    const invalidPatterns = [
      /^(não|nao|nenhum|nada|sem|não sei|nao sei|indefinido|desconhecido)$/i,
      /^(o vídeo|o video|a transcrição|a transcricao|legenda|transcrição|transcricao)$/i,
      /^(não foi possível|nao foi possivel|não identifiquei|nao identifiquei|não consegui|nao consegui)/i,
    ];
    if (invalidPatterns.some((re) => re.test(cleanName))) return null;

    return cleanName;
  } catch (error) {
    log.error("Falha ao extrair nome do produto com OpenAI", { error });
    return null;
  }
}

// ─── Busca paginada segura (EchoTik) ─────────────────────────────────────

/**
 * Busca vídeos da hashtag com paginação SEGURA.
 *
 * A EchoTik retorna Erro 500 (Risk Control) se pedirmos muitos vídeos de
 * uma vez (count > 20) na /api/v3/realtime/hashtag/video/list.
 *
 * Estratégia:
 * - Cada chamada usa no máximo `ECHOTIK_PAGE_SIZE` (20) vídeos
 * - Se o admin pedir mais (20-400), pagina com `offset` de 20 em 20
 * - Delay de ~2s (`ECHOTIK_PAGE_DELAY_MS`) entre chamadas
 * - Dedup por `video_id` para evitar repetições entre páginas
 *
 * Obs: O parâmetro de ordenação (`sortType`) NÃO é enviado na URL (evita
 * erro 400 — documentação não confirmada). Por padrão a API já retorna
 * vídeos populares na hashtag.
 *
 * @param hashtagId - ID da hashtag no EchoTik
 * @param region    - Região (default "BR")
 * @param count     - Quantidade desejada (clamp 20-400)
 * @returns Lista de vídeos únicos (deduplicados)
 */
interface HashtagPageResult {
  /** Vídeos da página que passaram nos filtros de views e idade */
  videos: EchoTikVideoDTO[];
  /** Itens brutos devolvidos — é por este número que o offset avança */
  rawCount: number;
  /** false quando a hashtag acabou, falhou ou sinalizou has_more=0 */
  continua: boolean;
}

/**
 * Busca UMA página de uma hashtag e aplica os filtros de relevância.
 *
 * Antes esta função paginava a hashtag inteira até completar uma cota. Isso
 * fazia a descoberta consumir todo o orçamento nas primeiras hashtags da
 * lista e nunca chegar nas últimas — com 8 hashtags configuradas, só ~3 eram
 * visitadas, e sempre as mesmas, sempre desde a página 0. Daí a repetição:
 * numa execução real, 33 dos 42 vídeos encontrados já tinham sido processados.
 *
 * Quem controla a paginação agora é o laço de round-robin em
 * `descobrirVideos`, que dá uma página para cada hashtag por rodada.
 */
async function fetchHashtagPage(
  hashtagId: string,
  region: string,
  offset: number,
  minViews: number,
  maxAgeCutoff: Date,
): Promise<HashtagPageResult> {
  const vazio: HashtagPageResult = { videos: [], rawCount: 0, continua: false };

  let response;
  try {
    response = await fetchVideosByHashtag({
      hashtagId,
      region,
      count: ECHOTIK_PAGE_SIZE,
      offset,
    });
  } catch (error) {
    log.warn(`Falha ao buscar página da hashtag (offset=${offset})`, {
      hashtagId,
      error: error instanceof Error ? error.message : String(error),
    });
    return vazio;
  }

  const rawItems: EchotikHashtagVideoItem[] = response?.data?.aweme_list ?? [];
  if (rawItems.length === 0) {
    log.info("Hashtag sem mais vídeos", { hashtagId, offset });
    return vazio;
  }

  const videos: EchoTikVideoDTO[] = [];

  for (const video of mapAwemeListToVideos(rawItems)) {
    // Extração EXTREMAMENTE segura do play_count via parseViewsFromEchoTikItem.
    // A EchoTik pode devolver este campo em caminhos diferentes
    // (statistics.play_count, play_count raiz, views) e como String ou Number.
    const rawItem = rawItems.find((r) => r.aweme_id === video.video_id);
    const views = rawItem
      ? parseViewsFromEchoTikItem(rawItem)
      : Number(video.views ?? 0);

    if (isNaN(views) || views < minViews) continue;

    // Guarda de idade: a EchoTik não resolve download-url para vídeos muito
    // antigos. Sem isto, a cauda antiga da hashtag reaparece a cada execução,
    // gasta orçamento e nunca gera transcrição.
    const createdAt = tiktokVideoCreatedAt(video.video_id);
    if (createdAt && createdAt < maxAgeCutoff) continue;

    // Fixa o valor JÁ PARSEADO no DTO: é ele que ordena a fila por views mais
    // adiante, e reparsear depois poderia divergir do que passou no filtro.
    videos.push({ ...video, views });
  }

  // NÃO usar "página menor que o solicitado" como fim da lista: a EchoTik
  // devolve rotineiramente menos itens do que o pedido (ex: 19 para count=20)
  // e o fim prematuro fazia o cron parar na primeira página.
  return {
    videos,
    rawCount: rawItems.length,
    continua: response?.data?.has_more !== 0,
  };
}

/** Teto de rodadas do round-robin — trava contra laço infinito. */
const ACHADINHOS_MAX_ROUNDS = 10;

/**
 * Prioridade de processamento por faixa de views.
 *
 * O número devolvido é o APROVEITAMENTO MEDIDO da faixa: quantos por cento dos
 * vídeos processados naquela faixa viraram achadinho utilizável. Medido sobre
 * 226 vídeos do acervo em 2026-08-10:
 *
 *     3k – 50k     33%   (52 vídeos)
 *     50k – 200k   45%   (51)
 *     200k – 500k  71%   (49)   <- pico
 *     500k – 1M    60%   (20)
 *     1M – 3M      50%   (34)
 *     >= 3M        30%   (20)
 *
 * NÃO É MONOTÔNICO, e essa é a razão de existir esta função. A intuição de
 * "mais views, melhor" está errada na cauda: acima de 3M o aproveitamento cai
 * ao patamar da pior faixa. Vídeo muito viral costuma ser conteúdo de
 * entretenimento ou trend sem produto identificável — as falhas nessa faixa
 * são de "extração do nome do produto" e "vídeo sem fala transcrevível".
 *
 * Ordenar por views decrescente colocava justamente essa faixa na frente:
 * numa execução real, os 12 vídeos acima de 1M falharam TODOS enquanto os 7
 * acertos vieram da faixa de 193k a 973k.
 *
 * Revisar quando o acervo crescer — os percentuais são de amostras de 20 a 52
 * vídeos por faixa.
 */
export function prioridadePorViews(views: number): number {
  if (views >= 3_000_000) return 30;
  if (views >= 1_000_000) return 50;
  if (views >= 500_000) return 60;
  if (views >= 200_000) return 71;
  if (views >= 50_000) return 45;
  return 33;
}

/**
 * Descobre vídeos varrendo TODAS as hashtags configuradas, em round-robin.
 *
 * POR QUE ROUND-ROBIN
 * A descoberta tem orçamento de tempo próprio (DISCOVERY_BUDGET_MS). Varrendo
 * hashtag por hashtag até o fim, o orçamento acabava nas primeiras e as
 * últimas nunca eram lidas — a configuração aceitava 8 hashtags e na prática
 * só ~3 contribuíam.
 *
 * Uma página por hashtag por rodada garante que todas sejam olhadas antes de
 * qualquer uma ser aprofundada. Se o orçamento acabar no meio, o que se perde
 * é profundidade, não abrangência.
 */
async function descobrirVideos(
  hashtagIds: string[],
  region: string,
  alvo: number,
  discoveryDeadline: number,
  minViews: number,
  pageDelayMs: number,
): Promise<EchoTikVideoDTO[]> {
  const maxAgeCutoff = new Date(
    Date.now() - SHOPEE_DEFAULTS.ACHADINHOS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const vistos = new Set<string>();
  const videos: EchoTikVideoDTO[] = [];
  const cursores = hashtagIds.map((id) => ({
    id,
    offset: 0,
    ativa: true,
    /** Páginas seguidas sem nenhum vídeo novo */
    secas: 0,
  }));
  let primeiraChamada = true;

  log.info(
    `Descoberta em round-robin: ${hashtagIds.length} hashtags, alvo ${alvo} vídeos, ` +
      `orçamento ${Math.round((discoveryDeadline - Date.now()) / 1000)}s`,
  );

  for (let rodada = 0; rodada < ACHADINHOS_MAX_ROUNDS; rodada++) {
    const ativas = cursores.filter((c) => c.ativa);
    if (ativas.length === 0) break;

    for (const cursor of ativas) {
      if (videos.length >= alvo) return videos;
      if (Date.now() >= discoveryDeadline) {
        log.warn(
          `Orçamento de descoberta esgotado na rodada ${rodada + 1} — ` +
            `seguindo com ${videos.length} vídeos`,
        );
        return videos;
      }

      // Pausa ANTES de cada chamada, menos a primeira: a EchoTik aplica risk
      // control por frequência. Dormir depois da última seria desperdício de
      // orçamento sem nenhuma chamada para proteger.
      if (!primeiraChamada) await sleep(pageDelayMs);
      primeiraChamada = false;

      const page = await fetchHashtagPage(
        cursor.id,
        region,
        cursor.offset,
        minViews,
        maxAgeCutoff,
      );

      cursor.offset += page.rawCount;
      if (!page.continua || page.rawCount === 0) cursor.ativa = false;

      let novos = 0;
      for (const v of page.videos) {
        // Dedup GLOBAL: o mesmo vídeo costuma aparecer em várias hashtags de
        // achadinhos. Um repetido NÃO mata a hashtag de imediato — ele pode ter
        // vindo de outra fonte e ela ainda ter conteúdo próprio adiante.
        if (vistos.has(v.video_id)) continue;
        vistos.add(v.video_id);
        videos.push(v);
        novos++;
        if (videos.length >= alvo) break;
      }

      // Duas páginas seguidas sem nada novo: a hashtag está sobreposta às
      // outras ou já foi drenada. Continuar paginando gastaria orçamento (e
      // requisições contra o risk control) sem trazer conteúdo.
      cursor.secas = novos === 0 ? cursor.secas + 1 : 0;
      if (cursor.secas >= 2) cursor.ativa = false;

      log.info(
        `Rodada ${rodada + 1} · hashtag ${cursor.id}: ${page.rawCount} brutos, ` +
          `${page.videos.length} relevantes, ${novos} novos (total ${videos.length}/${alvo})`,
      );
    }
  }

  return videos;
}

// ─── Transcrição com fallback (Captions → Whisper Fast-Fail) ───────────────

export interface TranscriptWithSource {
  text: string;
  source: "echotik_captions" | "openai_whisper";
}

/**
 * Resultado da transcrição, distinguindo POR QUE falhou.
 *
 * A distinção importa para o cooldown de retentativa: uma indisponibilidade
 * da EchoTik não deve tirar um vídeo bom da fila por 24h.
 */
export type TranscriptOutcome =
  | ({ ok: true } & TranscriptWithSource)
  | {
      ok: false;
      /** true = culpa do fornecedor (retentar logo); false = do conteúdo */
      transient: boolean;
      reason: string;
    };

/**
 * Obtém a transcrição de um vídeo com fallback.
 *
 * Fluxo:
 * 1. Tentar captions nativos da EchoTik (rápido e gratuito)
 * 2. Se falhar ou não houver → tentar Whisper:
 *    a. Obter URL de download (fast-fail: 1-2 retries, delay ~1s)
 *    b. Se a EchoTik bloquear (Erro 500) → retorna null imediatamente
 *    c. Baixar vídeo (max 25MB) → transcrever com OpenAI Whisper
 * 3. Se qualquer passo falhar → retorna null (caller aplica `continue`)
 *
 * NUNCA deixa o cron travado esperando backoff exponencial longo.
 *
 * @param video - Dados do vídeo vindo do EchoTik
 * @returns Texto da transcrição + fonte, ou null se indisponível
 */
export async function getTranscriptWithFallback(
  video: EchoTikVideoDTO,
): Promise<TranscriptOutcome> {
  const { video_id: videoExternalId, author_name } = video;

  // ── Passo 1: Tentar captions nativos (EchoTik Captions) ──────────────
  try {
    const captions = await getVideoCaptions(videoExternalId);
    if (captions?.text) {
      const cleanText = parseCaptionToPlainText(captions.text) ?? captions.text;
      log.info(
        `Legenda nativa obtida via captions (${cleanText.length} caracteres) para ${videoExternalId}`,
      );
      return { ok: true, text: cleanText, source: "echotik_captions" };
    }
  } catch (error) {
    log.warn(`Captions indisponíveis para ${videoExternalId} — tentando Whisper`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ── Passo 2: Fallback Whisper com Fast-Fail ───────────────────────────
  log.info(`Sem legenda nativa para ${videoExternalId} — tentando Whisper (fallback)`);

  try {
    // 2a. Obter URL de download — Fast-Fail:
    //     retries mínimos (1) + fastFailRiskControl (lança imediatamente
    //     se a EchoTik retornar code=500 de risk control)
    const tiktokUrl = buildCanonicalTikTokUrl(videoExternalId, author_name);
    const urls = await getVideoDownloadUrl(videoExternalId, tiktokUrl);

    if (!urls) {
      log.info(`Download URL indisponível para ${videoExternalId} — pulando (fast-fail)`);
      // Fornecedor indisponível (500 / risk control) — o vídeo pode ser bom
      return { ok: false, transient: true, reason: "URL de download indisponível na EchoTik" };
    }

    // 2b. Baixar vídeo (max 25MB — limite do Whisper API)
    const videoBuffer = await downloadVideoBuffer(urls);
    if (!videoBuffer) {
      log.info(`Download do vídeo falhou para ${videoExternalId} — pulando (fast-fail)`);
      return { ok: false, transient: true, reason: "Download do vídeo falhou" };
    }

    // 2c. Transcrever com Whisper
    const whisperResult = await transcribeWithWhisper(
      videoBuffer,
      `${videoExternalId}.mp4`,
    );

    if (isWhisperError(whisperResult)) {
      log.warn(`Whisper falhou para ${videoExternalId} — pulando`, {
        error: whisperResult.error,
      });
      return { ok: false, transient: true, reason: `Whisper falhou: ${whisperResult.error}` };
    }

    const text = whisperResult.text?.trim();
    if (!text || text.length < 3) {
      // Áudio sem fala aproveitável — isto é do CONTEÚDO, não do fornecedor
      log.warn(`Whisper retornou texto vazio para ${videoExternalId} — pulando`);
      return { ok: false, transient: false, reason: "Vídeo sem fala transcrevível" };
    }

    log.info(
      `Transcrição via Whisper obtida para ${videoExternalId} (${text.length} caracteres, lang=${whisperResult.language})`,
    );
    return { ok: true, text, source: "openai_whisper" };
  } catch (error) {
    // Fast-fail: a EchoTik bloqueou o download ou deu time out — retorna
    // null imediatamente para o caller aplicar `continue` no próximo vídeo.
    log.warn(`Falha no fallback Whisper para ${videoExternalId} — pulando (fast-fail)`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      transient: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Busca Shopee + merge rigoroso ────────────────────────────────────────

/**
 * Busca o melhor produto na Shopee para o nome extraído, aplicando filtro
 * rigoroso (vendas > 0 e preço > 0). Retorna null se nada válido for encontrado.
 */
async function findValidShopeeProduct(productName: string) {
  try {
    return await findBestShopeeOffer(productName);
  } catch (error) {
    log.warn(`Shopee API indisponível para "${productName}". Usando fallback.`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Persiste o resultado do produto encontrado no registro com merge rigoroso.
 *
 * Merge de dados:
 * - Dados da Echotik: views (play_count), tiktokVideoUrl (videoUrl)
 * - Dados da Shopee: price (preço), sales (vendas), commission (comissão),
 *   shopeeAffiliateUrl (link de venda), category (categoria)
 *
 * A categoria é resolvida por `mapShopeeCategories`: primeiro pelos
 * productCatIds retornados pela Shopee, com fallback para o nome do produto
 * extraído pela IA. Alimenta o filtro de categoria do feed de achadinhos.
 *
 * @param recordId - ID do registro ShopeeAchadinhoProduct
 * @param productName - Nome do produto extraído pela IA
 * @param transcriptText - Legenda usada para extração
 */
async function saveProductResult(
  recordId: string,
  productName: string,
  transcriptText: string,
): Promise<void> {
  let affiliateLink: string;
  let originalAffLink: string;
  let price: number | null = null;
  let saleCount: number = 0;
  let commission: number | null = null;
  let productImageUrl: string | null = null;
  let productPriceMin: number | null = null;
  let productPriceMax: number | null = null;
  let productLink: string | null = null;

  const offer = await findValidShopeeProduct(productName);

  // Categoria: productCatIds da Shopee quando houver oferta, com fallback
  // para o nome do produto extraído pela IA. Fica null se nada for resolvido.
  const { categoryName } = mapShopeeCategories(
    offer?.productCatIds ?? [],
    productName,
  );

  if (offer) {
    // LINK DIRETO DO PRODUTO — sem monetização.
    //
    // Antes o pipeline chamava generateShortLink(..., ["hyppado_achadinhos"]),
    // que assina o link com as credenciais de afiliado da plataforma. Ou seja:
    // o assinante divulgava o produto e a comissão caía na conta da Hyppado.
    // Decisão de produto: servir o link direto do produto, sem atribuição de
    // afiliado a ninguém. A plataforma entrega inteligência, não monetiza o
    // clique do assinante.
    //
    // Preferimos productLink (URL canônica do produto) e só caímos em
    // offerLink se ele não vier.
    affiliateLink =
      offer.productLink || offer.offerLink || buildShopeeSearchFallbackLink(productName);
    originalAffLink = affiliateLink;
    price = parseFloat(offer.priceMin || offer.priceMax) || null;
    saleCount = offer.sales || 0;
    commission = offer.commissionRate ? parseFloat(offer.commissionRate) : null;
    productImageUrl = offer.imageUrl || null;
    productPriceMin = offer.priceMin ? parseFloat(offer.priceMin) : null;
    productPriceMax = offer.priceMax ? parseFloat(offer.priceMax) : null;
    productLink = offer.productLink || offer.offerLink || null;
    log.info(`Produto encontrado na Shopee: "${offer.productName}" (${affiliateLink})`);
  } else {
    affiliateLink = buildShopeeSearchFallbackLink(productName);
    originalAffLink = affiliateLink;
    log.warn(`Nenhum produto válido na Shopee para "${productName}". Usando fallback.`);
  }

  // Merge rigoroso: salva os dados da Shopee + Echotik
  await prisma.shopeeAchadinhoProduct.update({
    where: { id: recordId },
    data: {
      status: "PENDING",
      transcriptText,
      productName,
      // Categoria — só grava quando resolvida, para não apagar um valor
      // bom de uma execução anterior num reprocessamento.
      ...(categoryName ? { category: categoryName } : {}),
      // Dados da Shopee
      price,
      saleCount,
      commission,
      // shopeeAffiliateUrl (link de venda)
      originalAffLink,
      affiliateLink,
      productImageUrl,
      productPriceMin,
      productPriceMax,
      productLink,
      errorMessage: null,
    },
  });
}

/**
 * Cria ou atualiza o registro do achadinho com status PROCESSING,
 * preenchendo tiktokVideoUrl, views e authorName vindos do EchoTik.
 */
/**
 * Persiste a capa do vídeo no Vercel Blob e devolve a URL permanente.
 *
 * POR QUE ISTO EXISTE
 * A EchoTik devolve a capa como URL assinada do CDN do TikTok, com
 * `x-expires` na query string. Guardar essa URL crua funciona por algumas
 * horas e depois passa a responder 403 — foi exatamente o que aconteceu com
 * todos os achadinhos já ingeridos: capa gravada, capa quebrada no dia
 * seguinte.
 *
 * O lado TikTok do produto já resolve isso (uploadPendingImages no cron da
 * EchoTik grava blobUrl permanente); o pipeline da Shopee nunca fez o mesmo.
 *
 * A janela para baixar é AGORA, enquanto a URL ainda é válida.
 *
 * @returns URL permanente do Blob, ou a URL original como fallback
 */
export async function cacheCoverToBlob(
  videoExternalId: string,
  coverUrl: string | null | undefined,
): Promise<string | null> {
  if (!coverUrl) return null;

  // Já é uma URL permanente — nada a fazer
  if (coverUrl.includes(".public.blob.vercel-storage.com")) return coverUrl;

  try {
    const blobUrl = await uploadImageToBlob(
      coverUrl,
      `shopee/achadinhos/${videoExternalId}.jpg`,
    );

    if (blobUrl) {
      log.info(`Capa persistida no Blob para ${videoExternalId}`);
      return blobUrl;
    }
  } catch (error) {
    log.warn(`Falha ao persistir capa no Blob para ${videoExternalId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fallback: guarda a URL original. Vai expirar, mas é melhor que nada e a
  // próxima execução tenta de novo (o update também atualiza a capa).
  return coverUrl;
}

async function upsertProcessingRecord(video: EchoTikVideoDTO) {
  const { video_id: videoExternalId, video_desc, cover_url, author_name, views } = video;

  // URL canônica do TikTok (tiktokVideoUrl — para embed/player)
  const canonicalTikTokUrl = buildCanonicalTikTokUrl(videoExternalId, author_name);

  // Baixa a capa enquanto a URL assinada ainda é válida
  const coverUrl = await cacheCoverToBlob(videoExternalId, cover_url);

  return prisma.shopeeAchadinhoProduct.upsert({
    where: { videoExternalId },
    update: {
      status: "PROCESSING",
      errorMessage: null,
      // tiktokVideoUrl — URL canônica do TikTok
      videoUrl: canonicalTikTokUrl,
      views: BigInt(views ?? 0),
      authorName: author_name ?? null,
      // A capa TAMBÉM é atualizada no update: antes só era gravada no create,
      // então um registro que nasceu sem capa (ou com capa expirada) nunca se
      // recuperava, mesmo sendo reprocessado.
      ...(coverUrl ? { coverUrl } : {}),
      ...(video_desc ? { videoTitle: video_desc } : {}),
    },
    create: {
      videoExternalId,
      // tiktokVideoUrl — URL canônica do TikTok
      videoUrl: canonicalTikTokUrl,
      videoTitle: video_desc || null,
      coverUrl,
      views: BigInt(views ?? 0),
      authorName: author_name ?? null,
      status: "PROCESSING",
    },
  });
}

// ─── Processamento de um vídeo (unidade canônica) ──────────────────────────

/**
 * Processa UM vídeo de ponta a ponta e persiste o resultado.
 *
 * Esta é a única implementação do fluxo por vídeo — o lote apenas a chama em
 * série. Persistir aqui (e não numa segunda fase) é o que torna o job
 * resistente ao limite de execução da Vercel: se a função for morta, tudo que
 * já rodou está salvo e a próxima execução pula estes vídeos.
 *
 * Fluxo:
 * 1. Marca PROCESSING (grava views, authorName e a URL canônica do TikTok)
 * 2. Transcrição: Captions → fallback Whisper (fast-fail)
 *    - Salva o texto imediatamente: nunca perder um Whisper já pago
 * 3. Extrai o nome do produto via GPT — "NULL"/inválido → FAILED
 * 4. Busca na Shopee (vendas > 0 e preço > 0) e salva como PENDING
 *
 * PENDING é o estado terminal de sucesso: o achadinho fica aguardando
 * aprovação de um admin antes de aparecer para o usuário final.
 *
 * @param video - Dados do vídeo vindos do EchoTik
 * @param transcriptOverride - Transcrição já obtida (evita refazer o trabalho)
 * @returns true se chegou a PENDING, false se foi descartado
 */
export async function processAchadinhoVideo(
  video: EchoTikVideoDTO,
  transcriptOverride?: TranscriptWithSource,
): Promise<boolean> {
  const { video_id: videoExternalId } = video;

  try {
    log.info(`Processando vídeo: ${videoExternalId}`);

    // Cria ou atualiza o registro com status PROCESSING + tiktokVideoUrl + views
    const record = await upsertProcessingRecord(video);

    // 1. Transcrição com fallback (Captions → Whisper fast-fail)
    const transcript: TranscriptOutcome = transcriptOverride
      ? { ok: true, ...transcriptOverride }
      : await getTranscriptWithFallback(video);

    if (!transcript.ok) {
      // Falha do FORNECEDOR é marcada como transitória: o vídeo entra de novo
      // na fila em 1h em vez de 24h. Sem isso, um rate limit da EchoTik tira
      // vídeos legítimos de circulação por um dia inteiro.
      const prefix = transcript.transient ? `${TRANSIENT_ERROR_PREFIX} ` : "";
      log.info(
        `Sem transcrição para ${videoExternalId} — pulando (${transcript.transient ? "transitório" : "definitivo"})`,
      );
      await prisma.shopeeAchadinhoProduct.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          errorMessage: `${prefix}${transcript.reason}`,
        },
      });
      return false;
    }

    const transcriptText = transcript.text;

    // Salva a transcrição imediatamente — nunca perder o texto (nem o custo
    // do Whisper) caso a extração do produto falhe ou a função seja morta.
    await prisma.shopeeAchadinhoProduct.update({
      where: { id: record.id },
      data: { transcriptText },
    });

    // 2. Extrai o nome do produto via OpenAI GPT (descrição + transcrição)
    log.info(`Extraindo nome do produto com GPT: ${videoExternalId}`);
    const productName = await extractProductName(video.video_desc, transcriptText);
    if (!productName) {
      // warn, não error: o GPT devolver NULL é operação NORMAL (vídeo sem
      // produto identificável). Logar como error polui o painel de erros.
      log.warn(`Nenhum produto identificado — pulando: ${videoExternalId}`);
      await prisma.shopeeAchadinhoProduct.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          transcriptText,
          errorMessage: "Extração do nome do produto falhou — vídeo pulado",
        },
      });
      return false;
    }
    log.info(`Nome do produto extraído: "${productName}"`);

    // 3. Busca na Shopee com filtro rigoroso + 4. Salva com status PENDING
    await saveProductResult(record.id, productName, transcriptText);

    log.info(
      `Pipeline concluído para ${videoExternalId}. Status: PENDING (aguardando aprovação).`,
    );
    return true;
  } catch (error) {
    log.error(`Erro no pipeline para ${videoExternalId}`, { error });
    try {
      await prisma.shopeeAchadinhoProduct.update({
        where: { videoExternalId },
        data: {
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Erro desconhecido no pipeline",
        },
      });
    } catch (dbError) {
      log.error("Não foi possível registrar falha no banco", { dbError });
    }
    return false;
  }
}

/**
 * Aposenta os achadinhos publicados mais antigos que excederem o alvo.
 *
 * O alvo é o tamanho do feed. Quando a renovação traz conteúdo novo e o admin
 * aprova, o feed passa do tamanho pedido — os mais antigos então cedem lugar.
 *
 * DUAS DECISÕES QUE IMPORTAM
 *
 * 1. Só mexe em READY. PENDING está esperando revisão do admin: arquivar aí
 *    seria descartar trabalho que ninguém olhou. Como todo achadinho novo
 *    entra em PENDING, o feed só encolhe DEPOIS que um substituto já foi
 *    publicado — nunca há um vale em que o feed fica menor que o alvo.
 *
 * 2. ARCHIVED, não REJECTED. Rejeitado é conteúdo que o admin recusou e que
 *    nunca foi ao ar; arquivado é conteúdo que foi publicado e saiu por
 *    rotação. Misturar os dois sujaria a fila de revisão.
 *
 * @returns quantos foram arquivados
 */
export async function trimAchadinhosToTarget(target: number): Promise<number> {
  if (!target || target <= 0) return 0;

  const publicados = await prisma.shopeeAchadinhoProduct.count({
    where: { status: "READY" },
  });
  if (publicados <= target) return 0;

  // Os mais recentes ficam; o excedente mais antigo sai.
  const excedente = await prisma.shopeeAchadinhoProduct.findMany({
    where: { status: "READY" },
    orderBy: { createdAt: "desc" },
    skip: target,
    select: { id: true },
  });
  if (excedente.length === 0) return 0;

  const { count } = await prisma.shopeeAchadinhoProduct.updateMany({
    where: { id: { in: excedente.map((r) => r.id) } },
    data: { status: "ARCHIVED" },
  });

  log.info(
    `Rotação do feed: ${count} achadinhos antigos arquivados para manter o alvo de ${target}`,
  );
  return count;
}

// ─── Orquestrador do lote (com orçamento de tempo) ─────────────────────────

export interface ProcessAchadinhosBatchOptions {
  /** hashtag_ids da EchoTik — se omitido, usa as settings configuradas */
  hashtagIds?: string[];
  /**
   * Teto de achadinhos exibíveis. O lote para assim que o inventário
   * (PENDING + READY) alcança este número — não adianta processar mais.
   *
   * Numa execução de RENOVAÇÃO o cron passa aqui um teto maior que o tamanho
   * do feed (alvo + lote de renovação): estar no alvo é justamente a condição
   * para trazer conteúdo novo. Como o inventário é recontado do banco a cada
   * invocação, um teto absoluto continua valendo em lotes parciais — uma cota
   * "por execução" reiniciaria a cada continuação e cresceria sem controle.
   */
  targetInventory?: number;
  /** Região — default "BR" (evita vídeos EN/ES) */
  region?: string;
  /**
   * Pausa entre chamadas de descoberta, em ms. Default ECHOTIK_PAGE_DELAY_MS
   * (2s), que é a proteção contra o risk control da EchoTik. Existe para os
   * testes poderem zerar a pausa sem esperar de verdade.
   */
  pageDelayMs?: number;
  /** Quantidade de vídeos a considerar (20-400) */
  count?: number;
  /**
   * Orçamento de tempo do laço em ms. O lote para sozinho antes de estourar
   * o maxDuration da função. Default: `achadinhosLoopBudgetMs()`.
   */
  budgetMs?: number;
}

export interface AchadinhosBatchResult {
  /** Vídeos retornados pela hashtag (após filtro de relevância) */
  found: number;
  /** Vídeos pulados por já terem sido processados antes */
  alreadyProcessed: number;
  /** Vídeos que passaram pelo pipeline nesta execução */
  processed: number;
  /** Destes, quantos chegaram a PENDING */
  succeeded: number;
  /** Vídeos elegíveis que ficaram para a próxima execução */
  remaining: number;
  /** true se o laço parou por orçamento (lote parcial) */
  partial: boolean;
  /** Duração total do lote em ms */
  elapsedMs: number;
  /** Inventário de exibíveis (PENDING + READY) ao fim do lote */
  inventory?: number;
  /** true se parou por ter atingido o teto de inventário */
  targetReached?: boolean;
}

/**
 * Decide quais vídeos ainda precisam ser processados.
 *
 * Uma única consulta ao banco para todo o lote. Pula:
 * - READY / PENDING / REJECTED — já passaram pelo pipeline (PENDING é o
 *   estado terminal de sucesso, aguardando revisão do admin)
 * - FAILED recente — cooldown, para que os mesmos vídeos ruins não consumam
 *   o orçamento de todas as execuções
 *
 * Reprocessa PROCESSING: esse status só sobra quando uma execução anterior
 * foi morta no meio do vídeo.
 */
async function filterUnprocessedVideos(
  videos: EchoTikVideoDTO[],
): Promise<{ pending: EchoTikVideoDTO[]; alreadyProcessed: number }> {
  if (videos.length === 0) return { pending: [], alreadyProcessed: 0 };

  const existing = await prisma.shopeeAchadinhoProduct.findMany({
    where: { videoExternalId: { in: videos.map((v) => v.video_id) } },
    select: {
      videoExternalId: true,
      status: true,
      updatedAt: true,
      errorMessage: true,
    },
  });

  const byId = new Map(existing.map((e) => [e.videoExternalId, e]));
  const now = Date.now();
  const failedRetryThreshold = new Date(
    now - SHOPEE_BUDGET.FAILED_RETRY_COOLDOWN_MS,
  );
  const transientRetryThreshold = new Date(
    now - SHOPEE_BUDGET.TRANSIENT_RETRY_COOLDOWN_MS,
  );

  const pending = videos.filter((video) => {
    const row = byId.get(video.video_id);
    if (!row) return true;

    if (row.status === "FAILED") {
      // Cooldown curto para falhas do fornecedor, longo para falhas de
      // conteúdo. Um 500 da EchoTik não deve custar 24h de um vídeo bom.
      const threshold = isTransientFailure(row.errorMessage)
        ? transientRetryThreshold
        : failedRetryThreshold;
      return row.updatedAt < threshold;
    }

    // PROCESSING = execução anterior interrompida → reprocessar
    return row.status === "PROCESSING";
  });

  return { pending, alreadyProcessed: videos.length - pending.length };
}

/**
 * Executa o lote de ingestão de "Achadinhos Shopee" dentro de um orçamento
 * de tempo.
 *
 * POR QUE ORÇAMENTO
 * A rota do cron declara maxDuration = 300s e o pipeline é sequencial. Um
 * único vídeo no pior caso custa ~230s. Sem orçamento, a função é morta pela
 * plataforma — e, na estrutura antiga (transcrever tudo em memória e só
 * depois salvar), todo o trabalho já pago era perdido.
 *
 * COMO FUNCIONA
 * 1. Descobre os vídeos da hashtag (com orçamento próprio de descoberta)
 * 2. Pula os que já foram processados — é isso que torna as execuções
 *    consecutivas cumulativas em vez de repetitivas
 * 3. Processa em série, persistindo CADA vídeo antes de passar ao próximo
 * 4. Antes de cada vídeo, verifica se ainda cabe o pior caso no orçamento;
 *    se não couber, encerra e devolve `partial: true`
 *
 * Um lote parcial NÃO é um erro: o próximo cron continua de onde parou.
 */
export async function processAchadinhosBatch(
  options: ProcessAchadinhosBatchOptions = {},
): Promise<AchadinhosBatchResult> {
  const startedAt = Date.now();
  const budgetMs = options.budgetMs ?? achadinhosLoopBudgetMs();
  const deadline = startedAt + budgetMs;
  const region = options.region ?? SHOPEE_DEFAULTS.ACHADINHOS_REGION;

  const empty: AchadinhosBatchResult = {
    found: 0,
    alreadyProcessed: 0,
    processed: 0,
    succeeded: 0,
    remaining: 0,
    partial: false,
    elapsedMs: 0,
  };

  let hashtagIds = options.hashtagIds;

  // Resolve as hashtags: param → env → settings → fallback padrão
  if (!hashtagIds || hashtagIds.length === 0) {
    try {
      hashtagIds = await getAchadinhosHashtagIds();
      if (hashtagIds.length === 0) {
        log.warn("Nenhuma hashtag disponível para o pipeline de achadinhos");
        return { ...empty, elapsedMs: Date.now() - startedAt };
      }
    } catch (error) {
      log.error("Falha ao resolver hashtags para o pipeline de achadinhos", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { ...empty, elapsedMs: Date.now() - startedAt };
    }
  }

  // Teto defensivo: a validação está na API admin, mas configurações gravadas
  // antes dela (ou via env) podem trazer mais. Cortar aqui é honesto — as
  // excedentes não seriam varridas de qualquer jeito, o orçamento acabaria antes.
  if (hashtagIds.length > ACHADINHOS_MAX_HASHTAGS) {
    log.warn(
      `${hashtagIds.length} hashtags configuradas, acima do teto de ${ACHADINHOS_MAX_HASHTAGS} — ` +
        `as excedentes serão ignoradas`,
      { ignoradas: hashtagIds.slice(ACHADINHOS_MAX_HASHTAGS) },
    );
    hashtagIds = hashtagIds.slice(0, ACHADINHOS_MAX_HASHTAGS);
  }

  // Passo 1: descoberta, limitada ao seu próprio orçamento
  const discoveryDeadline = Math.min(
    startedAt + SHOPEE_BUDGET.DISCOVERY_BUDGET_MS,
    deadline,
  );
  // Piso de views configurável pelo admin (shopee.achadinhos_min_views)
  const minViewsSetting = await getSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_MIN_VIEWS);
  const minViews =
    minViewsSetting && !isNaN(parseInt(minViewsSetting, 10))
      ? Math.max(0, parseInt(minViewsSetting, 10))
      : SHOPEE_DEFAULTS.ACHADINHOS_MIN_VIEWS;

  // Descoberta em round-robin entre TODAS as hashtags, com dedup por video_id
  // (o mesmo vídeo costuma aparecer em #achadinhosshopee e #achadinhoshopee).
  const alvoDescoberta = Math.min(
    ACHADINHOS_MAX_COUNT,
    Math.max(ACHADINHOS_MIN_COUNT, options.count ?? SHOPEE_DEFAULTS.ACHADINHOS_COUNT),
  );

  const videos = await descobrirVideos(
    hashtagIds,
    region,
    alvoDescoberta,
    discoveryDeadline,
    minViews,
    options.pageDelayMs ?? ECHOTIK_PAGE_DELAY_MS,
  );

  if (videos.length === 0) {
    log.info("Nenhum vídeo retornado pelas hashtags", { hashtagIds, region });
    return { ...empty, elapsedMs: Date.now() - startedAt };
  }

  // Passo 2: descartar o que já foi processado (torna o lote resumível)
  const { pending, alreadyProcessed } = await filterUnprocessedVideos(videos);

  // Passo 2.1: os mais promissores primeiro.
  //
  // O orçamento de processamento é o recurso escasso — um vídeo custa até 90s
  // entre Whisper, GPT e Shopee, e o lote só cabe ~20 por execução. Processar
  // na ordem em que a hashtag devolveu gastava o orçamento em vídeos ruins
  // enquanto os bons ficavam na fila.
  pending.sort((a, b) => {
    const pa = prioridadePorViews(Number(a.views ?? 0));
    const pb = prioridadePorViews(Number(b.views ?? 0));
    if (pa !== pb) return pb - pa;
    return Number(b.views ?? 0) - Number(a.views ?? 0);
  });

  log.info(
    `Lote de achadinhos: ${videos.length} vídeos encontrados, ` +
      `${alreadyProcessed} já processados, ${pending.length} a processar ` +
      `(orçamento ${Math.round(budgetMs / 1000)}s). ` +
      `Views do primeiro: ${Number(pending[0]?.views ?? 0).toLocaleString("pt-BR")}`,
  );

  // Passo 3: processar em série, persistindo a cada vídeo
  let processed = 0;
  let succeeded = 0;
  let partial = false;

  // Inventário atual de exibíveis — o alvo é sobre o que o usuário VÊ, não
  // sobre quantos vídeos varremos.
  let exibiveis = options.targetInventory
    ? await prisma.shopeeAchadinhoProduct.count({
        where: { status: { in: ["PENDING", "READY"] } },
      })
    : 0;

  for (const video of pending) {
    // Teto atingido no meio do lote: parar. Processar mais só gastaria
    // Whisper/GPT para engordar uma fila que já está no tamanho pedido.
    if (options.targetInventory && exibiveis >= options.targetInventory) {
      log.info(
        `Teto de ${options.targetInventory} achadinhos exibíveis atingido — encerrando lote`,
        { exibiveis, processados: processed },
      );
      break;
    }

    // Só inicia mais um vídeo se o pior caso ainda couber no orçamento.
    // Sem esta guarda, um Whisper de 120s iniciado faltando 20s seria morto
    // pela plataforma no meio da escrita.
    const remainingMs = deadline - Date.now();
    if (remainingMs < SHOPEE_BUDGET.VIDEO_WORST_CASE_MS) {
      partial = true;
      log.warn(
        `Orçamento esgotado após ${processed} vídeos ` +
          `(${Math.round(remainingMs / 1000)}s restantes). ` +
          `${pending.length - processed} ficam para a próxima execução.`,
      );
      break;
    }

    const ok = await processAchadinhoVideo(video);
    processed++;
    if (ok) {
      succeeded++;
      exibiveis++; // chegou em PENDING, já conta como exibível
    }
  }

  const result: AchadinhosBatchResult = {
    inventory: exibiveis,
    targetReached: !!options.targetInventory && exibiveis >= options.targetInventory,
    found: videos.length,
    alreadyProcessed,
    processed,
    succeeded,
    remaining: pending.length - processed,
    partial,
    elapsedMs: Date.now() - startedAt,
  };

  log.info(
    `Lote de achadinhos concluído em ${Math.round(result.elapsedMs / 1000)}s: ` +
      `${succeeded}/${processed} com sucesso, ${result.remaining} restantes` +
      (partial ? " (LOTE PARCIAL — próximo cron continua)" : ""),
  );

  return result;
}
