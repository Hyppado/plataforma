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
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { parseCaptionToPlainText } from "@/lib/transcription/media";
import { getVideoCaptions } from "@/lib/transcription/media";
import { getVideoDownloadUrl, downloadVideoBuffer } from "@/lib/transcription/media";
import { transcribeWithWhisper, isWhisperError } from "@/lib/transcription/whisper";
import { getSecretSetting, SETTING_KEYS } from "@/lib/settings";
import { findBestShopeeOffer, generateShortLink } from "@/lib/shopee/shopee-api-client";
import {
  type EchoTikVideoDTO,
  GPT_PRODUCT_EXTRACTION_SYSTEM_PROMPT,
  buildProductExtractionPrompt,
  buildShopeeSearchFallbackLink,
  SHOPEE_DEFAULTS,
} from "@/lib/shopee/types";
import {
  fetchVideosByHashtag,
  type EchotikHashtagVideoItem,
} from "@/lib/echotik/client";
import {
  mapAwemeListToVideos,
  getAchadinhosHashtagId,
  parseViewsFromEchoTikItem,
} from "@/lib/shopee/client";

const log = createLogger("shopee/pipeline");

// ─── Constantes de paginação segura (Echotik Risk Control) ────────────────

/** Bloco máximo seguro por chamada à API da EchoTik */
const ECHOTIK_PAGE_SIZE = 20;
/** Delay entre chamadas paginadas (~2s) para não estourar risk control */
const ECHOTIK_PAGE_DELAY_MS = 2_000;
/** Limite mínimo/máximo suportado pelo admin (20-400) */
const ACHADINHOS_MIN_COUNT = 20;
const ACHADINHOS_MAX_COUNT = 400;
/** Filtro de relevância: apenas vídeos com >= 30k views entram no pipeline */
const MIN_VIEWS_THRESHOLD = 30_000;

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
async function fetchVideosByHashtagPaginated(
  hashtagId: string,
  region: string,
  count: number,
): Promise<EchoTikVideoDTO[]> {
  const clampedCount = Math.min(ACHADINHOS_MAX_COUNT, Math.max(ACHADINHOS_MIN_COUNT, count));
  const seenIds = new Set<string>();
  const allVideos: EchoTikVideoDTO[] = [];

  log.info(
    `Paginação EchoTik: solicitando ${clampedCount} vídeos em blocos de ${ECHOTIK_PAGE_SIZE} (delay ${ECHOTIK_PAGE_DELAY_MS}ms)`,
    { hashtagId, region },
  );

  let offset = 0;
  let hasMore = true;

  while (hasMore && allVideos.length < clampedCount) {
    // Quantidade a pedir neste bloco: no máximo 20, respeitando o total
    const remaining = clampedCount - allVideos.length;
    const pageCount = Math.min(ECHOTIK_PAGE_SIZE, remaining);

    let response;
    try {
      response = await fetchVideosByHashtag({
        hashtagId,
        region,
        count: pageCount,
        offset,
      });
    } catch (error) {
      log.warn(
        `Falha na página ${offset / ECHOTIK_PAGE_SIZE + 1} da hashtag (offset=${offset}). Encerrando paginação.`,
        {
          hashtagId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      break;
    }

    const rawItems: EchotikHashtagVideoItem[] = response?.data?.aweme_list ?? [];

    if (rawItems.length === 0) {
      log.info("Nenhum vídeo adicional retornado — encerrando paginação", {
        hashtagId,
        offset,
      });
      break;
    }

    const pageVideos = mapAwemeListToVideos(rawItems);
    let added = 0;

    for (const video of pageVideos) {
      // ── Filtro de relevância: apenas vídeos "em alta" com >= 30k views ──
      // Extração EXTREMAMENTE segura do play_count via parseViewsFromEchoTikItem.
      // A EchoTik pode retornar este campo em caminhos diferentes
      // (statistics.play_count, play_count raiz, views) e como String ou Number.
      // A função força Number e trata NaN/undefined (retorna 0) — qualquer
      // valor inválido abaixo do threshold é descartado.
      const rawItem = rawItems.find((r) => r.aweme_id === video.video_id);
      const views = rawItem
        ? parseViewsFromEchoTikItem(rawItem)
        : Number(video.views ?? 0);

      if (isNaN(views) || views < MIN_VIEWS_THRESHOLD) {
        log.info(
          `Vídeo ${video.video_id} DESCARTADO por relevância — ` +
            `views=${isNaN(views) ? "NaN" : views}, threshold=${MIN_VIEWS_THRESHOLD}`,
        );
        continue;
      }

      if (seenIds.has(video.video_id)) continue;
      seenIds.add(video.video_id);
      allVideos.push(video);
      added++;

      if (allVideos.length >= clampedCount) break;
    }

    log.info(
      `Página ${offset / ECHOTIK_PAGE_SIZE + 1}: ${pageVideos.length} vídeos retornados, ${added} novos (total acumulado: ${allVideos.length}/${clampedCount})`,
    );

    // Se a página veio menor que o solicitado, não há mais páginas
    if (rawItems.length < pageCount) {
      hasMore = false;
      break;
    }

    // Verifica se a API indicou que há mais páginas (se disponível)
    const hasMoreFlag = response?.data?.has_more;
    if (hasMoreFlag === 0) {
      hasMore = false;
      break;
    }

    offset += rawItems.length;

    // Delay de ~2s entre chamadas paginadas (evita Risk Control da EchoTik)
    if (hasMore && allVideos.length < clampedCount) {
      log.info(`Aguardando ${ECHOTIK_PAGE_DELAY_MS}ms antes da próxima página...`);
      await sleep(ECHOTIK_PAGE_DELAY_MS);
    }
  }

  log.info(
    `Paginação EchoTik concluída: ${allVideos.length} vídeos únicos (solicitado: ${clampedCount})`,
  );
  return allVideos;
}

// ─── Transcrição com fallback (Captions → Whisper Fast-Fail) ───────────────

export interface TranscriptWithSource {
  text: string;
  source: "echotik_captions" | "openai_whisper";
}

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
): Promise<TranscriptWithSource | null> {
  const { video_id: videoExternalId, author_name } = video;

  // ── Passo 1: Tentar captions nativos (EchoTik Captions) ──────────────
  try {
    const captions = await getVideoCaptions(videoExternalId);
    if (captions?.text) {
      const cleanText = parseCaptionToPlainText(captions.text) ?? captions.text;
      log.info(
        `Legenda nativa obtida via captions (${cleanText.length} caracteres) para ${videoExternalId}`,
      );
      return { text: cleanText, source: "echotik_captions" };
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
      return null;
    }

    // 2b. Baixar vídeo (max 25MB — limite do Whisper API)
    const videoBuffer = await downloadVideoBuffer(urls);
    if (!videoBuffer) {
      log.info(`Download do vídeo falhou para ${videoExternalId} — pulando (fast-fail)`);
      return null;
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
      return null;
    }

    const text = whisperResult.text?.trim();
    if (!text || text.length < 3) {
      log.warn(`Whisper retornou texto vazio para ${videoExternalId} — pulando`);
      return null;
    }

    log.info(
      `Transcrição via Whisper obtida para ${videoExternalId} (${text.length} caracteres, lang=${whisperResult.language})`,
    );
    return { text, source: "openai_whisper" };
  } catch (error) {
    // Fast-fail: a EchoTik bloqueou o download ou deu time out — retorna
    // null imediatamente para o caller aplicar `continue` no próximo vídeo.
    log.warn(`Falha no fallback Whisper para ${videoExternalId} — pulando (fast-fail)`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
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
 *   shopeeAffiliateUrl (link de venda)
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
  if (offer) {
    // Tenta gerar link encurtado de afiliado (shopeeAffiliateUrl).
    // Se falhar (ex: link já encurtado s.shopee.com.br), usa o originUrl como fallback.
    let shortLink: string | null = null;
    if (offer.offerLink && !offer.offerLink.includes("s.shopee.com.br")) {
      try {
        shortLink = await generateShortLink(offer.offerLink, ["hyppado_achadinhos"]);
      } catch (error) {
        log.warn(`Falha ao gerar link de afiliado, usando original`, {
          offerLink: offer.offerLink,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // shopeeAffiliateUrl = link de venda da Shopee (encurtado ou original)
    affiliateLink = shortLink || offer.offerLink || buildShopeeSearchFallbackLink(productName);
    originalAffLink = offer.offerLink || affiliateLink;
    price = parseFloat(offer.priceMin || offer.priceMax) || null;
    saleCount = offer.sales || 0;
    commission = offer.commissionRate ? parseFloat(offer.commissionRate) : null;
    productImageUrl = offer.imageUrl || null;
    productPriceMin = offer.priceMin ? parseFloat(offer.priceMin) : null;
    productPriceMax = offer.priceMax ? parseFloat(offer.priceMax) : null;
    productLink = offer.offerLink || null;
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
async function upsertProcessingRecord(video: EchoTikVideoDTO) {
  const { video_id: videoExternalId, video_desc, cover_url, author_name, views } = video;

  // URL canônica do TikTok (tiktokVideoUrl — para embed/player)
  const canonicalTikTokUrl = buildCanonicalTikTokUrl(videoExternalId, author_name);

  return prisma.shopeeAchadinhoProduct.upsert({
    where: { videoExternalId },
    update: {
      status: "PROCESSING",
      errorMessage: null,
      // tiktokVideoUrl — URL canônica do TikTok
      videoUrl: canonicalTikTokUrl,
      views: BigInt(views ?? 0),
      authorName: author_name ?? null,
    },
    create: {
      videoExternalId,
      // tiktokVideoUrl — URL canônica do TikTok
      videoUrl: canonicalTikTokUrl,
      videoTitle: video_desc || null,
      coverUrl: cover_url || null,
      views: BigInt(views ?? 0),
      authorName: author_name ?? null,
      status: "PROCESSING",
    },
  });
}

/**
 * Processa um vídeo individual de forma eficiente.
 *
 * Fluxo (com fallback Whisper fast-fail):
 * 1. Obtém transcrição: Captions → se falhar, Whisper (fast-fail)
 *    - Se a transcrição falhar de tudo → continue
 * 2. Extrai nome do produto via GPT — se falhar, continue
 * 3. Busca na Shopee com filtro rigoroso (vendas > 0 e preço > 0)
 * 4. Salva com status PENDING com merge rigoroso de dados
 *
 * @param video - Dados do vídeo vindos do EchoTik
 * @returns true se processado com sucesso, false caso contrário
 */
export async function processAchadinhoVideoFast(video: EchoTikVideoDTO): Promise<boolean> {
  const { video_id: videoExternalId } = video;

  try {
    log.info(`Processando vídeo (fast-path): ${videoExternalId}`);

    // Verifica se já foi processado como READY (evita reprocessamento desnecessário)
    const existing = await prisma.shopeeAchadinhoProduct.findUnique({
      where: { videoExternalId },
      select: { status: true },
    });

    if (existing?.status === "READY") {
      log.info(`Vídeo ${videoExternalId} já processado como READY. Pulando.`);
      return true;
    }

    // Cria ou atualiza o registro com status PROCESSING + tiktokVideoUrl + views
    const record = await upsertProcessingRecord(video);

    // 1. Transcrição com fallback (Captions → Whisper fast-fail)
    //    Se falhar de tudo → marca FAILED e aplica continue
    const transcript = await getTranscriptWithFallback(video);
    if (!transcript) {
      log.info(`Sem transcrição (captions + Whisper) para ${videoExternalId} — pulando (continue)`);
      await prisma.shopeeAchadinhoProduct.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          errorMessage:
            "Sem transcrição disponível (captions Echotik e fallback Whisper falharam) — vídeo pulado",
        },
      });
      return false;
    }

    const transcriptText = transcript.text;

    // Salva a transcrição imediatamente — nunca perder o texto mesmo se a
    // extração do produto falhar.
    await prisma.shopeeAchadinhoProduct.update({
      where: { id: record.id },
      data: { transcriptText },
    });

    // 2. Extrai o nome do produto via OpenAI GPT (descrição + transcrição)
    //    Se a IA não conseguir identificar um nome válido → PULA O VÍDEO (continue)
    log.info(`Extraindo nome do produto com GPT (descrição + transcrição): ${videoExternalId}`);
    const productName = await extractProductName(video.video_desc, transcriptText);
    if (!productName) {
      log.error(`Falha na extração do nome do produto — pulando: ${videoExternalId}`);
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

    log.info(`Pipeline concluído para ${videoExternalId}. Status: PENDING (aguardando aprovação).`);
    return true;
  } catch (error) {
    log.error(`Erro no pipeline para ${videoExternalId}`, { error });
    try {
      await prisma.shopeeAchadinhoProduct.update({
        where: { videoExternalId },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Erro desconhecido no pipeline",
        },
      });
    } catch (dbError) {
      log.error("Não foi possível registrar falha no banco", { dbError });
    }
    return false;
  }
}

// ─── Orquestrador do pipeline ──────────────────────────────────────────────

export interface AchadinhosPipelineItem {
  video: EchoTikVideoDTO;
  /** Texto limpo da transcrição (plain text) */
  transcriptText: string;
  /** Fonte da transcrição: captions nativos ou Whisper */
  source: "echotik_captions" | "openai_whisper";
}

export interface ProcessAchadinhosPipelineOptions {
  /** hashtag_id da EchoTik — se omitido, usa setting configurada ou discovery dinâmico */
  hashtagId?: string;
  /** Região — default "BR" (evita vídeos EN/ES) */
  region?: string;
  /** Quantidade de vídeos (20-400) — configurada pelo admin */
  count?: number;
}

/**
 * Orquestra o pipeline de ingestão de "Achadinhos Shopee":
 *
 * 1. Busca a lista de vídeos da hashtag com PAGINAÇÃO SEGURA
 *    (`fetchVideosByHashtagPaginated`) — blocos de 20 com delay ~2s
 * 2. Para cada vídeo, busca transcrição via Captions + fallback Whisper:
 *    - Se falhar de tudo → continue (pula imediatamente)
 *
 * Tratamento de erros:
 * - Se a busca de vídeos falhar, retorna [] (não derruba o caller).
 * - No loop, cada vídeo é isolado com try/catch — falha em um vídeo
 *   apenas faz `continue` para o próximo.
 *
 * @returns Array com vídeo + transcrição pronta, ou [] se nada encontrado.
 */
export async function processAchadinhosPipeline(
  options: ProcessAchadinhosPipelineOptions = {},
): Promise<AchadinhosPipelineItem[]> {
  const region = options.region ?? SHOPEE_DEFAULTS.ACHADINHOS_REGION;

  let hashtagId = options.hashtagId;

  // Resolve o hashtag_id: param → env → setting → fallback padrão
  if (!hashtagId) {
    try {
      hashtagId = await getAchadinhosHashtagId();

      if (!hashtagId) {
        log.warn("Nenhum hashtag_id disponível para o pipeline de achadinhos");
        return [];
      }
    } catch (error) {
      log.error("Falha ao resolver hashtag_id para o pipeline de achadinhos", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // Passo 1: Buscar vídeos da hashtag com paginação segura (20/bloco + delay)
  const videos = await fetchVideosByHashtagPaginated(
    hashtagId,
    region,
    options.count ?? SHOPEE_DEFAULTS.ACHADINHOS_COUNT,
  );

  if (videos.length === 0) {
    log.info("Nenhum vídeo retornado pela hashtag", { hashtagId, region });
    return [];
  }

  log.info(`Pipeline de achadinhos: ${videos.length} vídeos encontrados`);

  const results: AchadinhosPipelineItem[] = [];

  // Passo 2: Para cada vídeo, buscar transcrição (Captions → Whisper fallback)
  for (const video of videos) {
    try {
      const transcript = await getTranscriptWithFallback(video);
      if (!transcript) {
        log.info(`Transcrição indisponível para ${video.video_id} — pulando`);
        continue;
      }

      results.push({
        video,
        transcriptText: transcript.text,
        source: transcript.source,
      });

      log.info(
        `Transcrição obtida para ${video.video_id} (${transcript.text.length} caracteres, fonte: ${transcript.source})`,
      );
    } catch (error) {
      // Isolamento por vídeo: falha em um não derruba o pipeline inteiro
      log.warn(`Falha ao obter transcrição do vídeo ${video.video_id} — pulando`, {
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
  }

  log.info(
    `Pipeline de achadinhos concluído: ${results.length}/${videos.length} vídeos com transcrição`,
  );
  return results;
}

/**
 * Salva um item do pipeline de achadinhos (vídeo + transcrição já pronta).
 *
 * Fluxo (captions → Whisper fast-fail já resolvido no pipeline):
 * 1. Verifica duplicidade (READY) e faz upsert com status PROCESSING
 * 2. Extrai o nome do produto via OpenAI GPT (`extractProductName`)
 * 3. Busca o produto real na Shopee Affiliate API (com filtro rigoroso)
 * 4. Salva com status PENDING — admin precisa revisar e aprovar
 *
 * @param item - Item unificado do `processAchadinhosPipeline` (vídeo + transcrição)
 * @returns true se salvo com sucesso, false caso contrário
 */
export async function saveAchadinhoFromPipelineItem(
  item: AchadinhosPipelineItem,
): Promise<boolean> {
  const { video, transcriptText, source } = item;
  const { video_id: videoExternalId } = video;

  try {
    log.info(`Salvando resultado do pipeline para ${videoExternalId}`, { source });

    // Verifica se já foi processado como READY (evita reprocessamento desnecessário)
    const existing = await prisma.shopeeAchadinhoProduct.findUnique({
      where: { videoExternalId },
      select: { status: true },
    });

    if (existing?.status === "READY") {
      log.info(`Vídeo ${videoExternalId} já processado como READY. Pulando.`);
      return true;
    }

    // Cria ou atualiza o registro com status PROCESSING + tiktokVideoUrl + views
    const record = await upsertProcessingRecord(video);

    // Salva a transcrição imediatamente — nunca perder o texto mesmo se a
    // extração do produto falhar.
    await prisma.shopeeAchadinhoProduct.update({
      where: { id: record.id },
      data: { transcriptText },
    });

    // 2. Extrai o nome do produto via OpenAI GPT (descrição + transcrição)
    //    Se a IA não conseguir identificar um nome válido → PULA O VÍDEO (continue)
    log.info(`Extraindo nome do produto com GPT (descrição + transcrição): ${videoExternalId}`);
    const productName = await extractProductName(video.video_desc, transcriptText);
    if (!productName) {
      log.error(`Falha na extração do nome do produto — pulando: ${videoExternalId}`);
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

    // 3. Busca produto na Shopee + 4. Salva com status PENDING
    await saveProductResult(record.id, productName, transcriptText);

    log.info(`Achadinho salvo para ${videoExternalId}. Status: PENDING (aguardando aprovação).`);
    return true;
  } catch (error) {
    log.error(`Erro ao salvar achadinho para ${videoExternalId}`, { error });
    try {
      await prisma.shopeeAchadinhoProduct.update({
        where: { videoExternalId },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Erro desconhecido ao salvar achadinho",
        },
      });
    } catch (dbError) {
      log.error("Não foi possível registrar falha no banco", { dbError });
    }
    return false;
  }
}