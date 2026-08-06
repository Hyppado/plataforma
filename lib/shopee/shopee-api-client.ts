/**
 * lib/shopee/shopee-api-client.ts
 *
 * Cliente HTTP para a Shopee Affiliate API (GraphQL).
 * Utiliza SHA-256 para autenticação, conforme documentação oficial:
 *
 * 1. Gera timestamp Unix em segundos
 * 2. Concatena: app_id + timestamp + payload + app_secret
 * 3. Gera SHA-256 do fator completo
 * 4. Envia no header: Authorization: SHA256 Credential={appId}, Timestamp={timestamp}, Signature={sign}
 *
 * URL Base: https://open-api.affiliate.shopee.com.br/graphql
 *
 * As credenciais (app_id e app_secret) são lidas da tabela Setting
 * (criptografadas em repouso), com fallback para variáveis de ambiente.
 */

import crypto from "crypto";
import { createLogger } from "@/lib/logger";
import { getSecretSetting, SETTING_KEYS } from "@/lib/settings";

const log = createLogger("shopee/api-client");

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const GRAPHQL_URL = "https://open-api.affiliate.shopee.com.br/graphql";

/**
 * Lê as credenciais da Shopee Affiliate.
 * Prioriza: Setting criptografada no banco → variável de ambiente
 */
async function getCredentials(): Promise<{ appId: string; appSecret: string }> {
  const appId = await getSecretSetting(SETTING_KEYS.SHOPEE_AFFILIATE_APP_ID)
    || process.env.SHOPEE_AFFILIATE_APP_ID
    || "";

  const appSecret = await getSecretSetting(SETTING_KEYS.SHOPEE_AFFILIATE_API_SECRET)
    || process.env.SHOPEE_AFFILIATE_API_SECRET
    || "";

  if (!appId || !appSecret) {
    throw new Error(
      "[shopee-api] Credenciais da Shopee Affiliate não configuradas. " +
      "Configure em Admin → Configuração → Shopee ou via .env (SHOPEE_AFFILIATE_APP_ID, SHOPEE_AFFILIATE_API_SECRET)."
    );
  }

  return { appId, appSecret };
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 Signature (formato GraphQL)
// ---------------------------------------------------------------------------

/**
 * Gera a assinatura SHA-256 para autenticação na Shopee Affiliate GraphQL API.
 *
 * Fórmula: Signature = SHA256(AppId + Timestamp + Payload + Secret)
 * Header: Authorization: SHA256 Credential={appId}, Timestamp={timestamp}, Signature={sign}
 *
 * ATENÇÃO: O Secret é concatenado no FINAL do fator, não usado como chave HMAC.
 * Conforme documentação oficial da Shopee Affiliate Open API.
 *
 * @param appId - App ID do parceiro
 * @param timestamp - Timestamp Unix em segundos (como string)
 * @param payload - Corpo JSON da requisição (sem espaços extras)
 * @param appSecret - Chave secreta do parceiro
 * @returns Assinatura SHA-256 em hex
 */
function generateSignature(
  appId: string,
  timestamp: string,
  payload: string,
  appSecret: string,
): string {
  // Fator: AppId + Timestamp + Payload + Secret (conforme documentação)
  const factor = `${appId}${timestamp}${payload}${appSecret}`;
  return crypto.createHash("sha256").update(factor).digest("hex");
}

// ---------------------------------------------------------------------------
// Utilitário para normalizar URLs de imagem da Shopee
// ---------------------------------------------------------------------------

/**
 * Normaliza URLs de imagem retornadas pela Shopee Affiliate API.
 *
 * A API da Shopee pode retornar URLs relativas ou com domínios quebrados.
 * Esta função garante que a URL seja absoluta, HTTPS e aponte para o CDN
 * correto da Shopee.
 *
 * @param url - URL bruta retornada pela API
 * @returns URL normalizada ou null se não for possível
 */
function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const trimmed = url.trim();

  // Se já é uma URL absoluta HTTPS, retorna como está
  if (trimmed.startsWith("https://")) return trimmed;

  // Se é URL absoluta HTTP, converte para HTTPS
  if (trimmed.startsWith("http://")) {
    return trimmed.replace("http://", "https://");
  }

  // Se é URL relativa começando com "//", adiciona HTTPS
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  // Se parece um caminho relativo (ex: "/file/123.jpg"), usa o CDN da Shopee
  if (trimmed.startsWith("/")) {
    return `https://down-br.img.susercontent.com${trimmed}`;
  }

  // Qualquer outro formato — retorna como está (pode ser data URL ou fallback)
  return trimmed;
}

// ---------------------------------------------------------------------------
// Tipos GraphQL — Product Offer V2
// ---------------------------------------------------------------------------

export interface ProductOfferNode {
  itemId: string;
  productName: string;
  /** Preço mínimo (string da API, ex: "45.99") */
  priceMin: string;
  /** Preço máximo (string da API, ex: "55.99") */
  priceMax: string;
  sales: number;
  commissionRate: string;
  imageUrl: string;
  offerLink: string;
  productLink: string;
  shopName: string;
  productCatIds: number[];
  ratingStar: string;
}

export interface ProductOfferV2Response {
  data?: {
    productOfferV2?: {
      nodes?: ProductOfferNode[];
      pageInfo?: {
        page: number;
        limit: number;
        hasNextPage: boolean;
      };
    };
  };
  errors?: Array<{ message: string; extensions?: { code: number } }>;
}

// ---------------------------------------------------------------------------
// Tipos GraphQL — Generate Short Link
// ---------------------------------------------------------------------------

export interface ShortLinkResponse {
  data?: {
    generateShortLink?: {
      shortLink: string;
      originalUrl?: string;
    };
  };
  errors?: Array<{ message: string }>;
}

// ---------------------------------------------------------------------------
// Erro tipado
// ---------------------------------------------------------------------------

/**
 * Falha ao falar com a Shopee Affiliate API.
 *
 * Existe para que os callers distingam "a busca não achou nada" (lista vazia)
 * de "a API está fora do ar" (exceção). Antes, ambos os casos viravam uma
 * lista vazia — o que fazia o ranking parecer legitimamente vazio durante uma
 * indisponibilidade do fornecedor e desarmava as proteções de
 * `syncShopeeRankings`.
 */
export class ShopeeApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ShopeeApiError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Escape de literais GraphQL
// ---------------------------------------------------------------------------

/**
 * Serializa um valor como literal de string GraphQL.
 *
 * Literais de string em GraphQL seguem a sintaxe de string do JSON, então
 * JSON.stringify produz um literal válido e trata aspas, barras invertidas,
 * quebras de linha e unicode.
 *
 * Substitui o escape manual anterior (`replace(/"/g, '\\"')`), que só cuidava
 * de aspas — uma barra invertida ou quebra de linha no nome do produto
 * quebrava a query. Isso importa porque o nome vem do GPT, que por sua vez
 * lê a legenda de um vídeo escrita por terceiros.
 */
function gqlString(value: string): string {
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Função genérica para chamadas GraphQL
// ---------------------------------------------------------------------------

/**
 * Executa uma query GraphQL na Shopee Affiliate API com assinatura SHA-256.
 *
 * Falhas de transporte, HTTP e erros GraphQL LANÇAM `ShopeeApiError` — nunca
 * devolvem resposta vazia. Cabe ao caller decidir o que fazer:
 * - o pipeline de achadinhos cai no link de busca de fallback
 * - o sync do ranking conta a falha e preserva os dados atuais
 *
 * @param query - A query GraphQL completa (string) em linha única
 * @throws ShopeeApiError
 */
async function graphqlRequest<T>(query: string): Promise<T> {
  const { appId, appSecret } = await getCredentials();
  const timestamp = String(Math.floor(Date.now() / 1000));

  // Monta o payload JSON sem espaços extras (exigido pela Shopee)
  const payload = JSON.stringify({ query });

  // Gera a assinatura SHA-256
  const sign = generateSignature(appId, timestamp, payload, appSecret);

  // Header de autenticação
  const authHeader = `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${sign}`;

  log.info("Chamando Shopee Affiliate GraphQL API", {
    queryPreview: query.slice(0, 120),
    timestamp,
  });

  let response: Response;
  try {
    response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: payload,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Falha de transporte na Shopee Affiliate GraphQL API", { message });
    throw new ShopeeApiError(`Falha de rede ao chamar a Shopee: ${message}`);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    log.error("Erro HTTP da Shopee Affiliate GraphQL API", {
      status: response.status,
      body: errorBody.slice(0, 500),
    });
    throw new ShopeeApiError(
      `Shopee respondeu HTTP ${response.status}`,
      response.status,
    );
  }

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch (error) {
    throw new ShopeeApiError(
      `Resposta da Shopee não é JSON válido: ${
        error instanceof Error ? error.message : String(error)
      }`,
      response.status,
    );
  }

  // Erros no envelope GraphQL (HTTP 200 com "errors") também são falhas
  const errors = (data as { errors?: Array<{ message?: string }> })?.errors;
  if (errors?.length) {
    const detail = errors.map((e) => e.message ?? "erro desconhecido").join("; ");
    log.error("Shopee Affiliate GraphQL retornou erros", { detail });
    throw new ShopeeApiError(`Shopee GraphQL: ${detail}`, response.status);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Funções públicas
// ---------------------------------------------------------------------------

/**
 * Busca produtos na Shopee Affiliate API usando a query productOfferV2.
 *
 * @param keyword  - Termo de busca
 * @param sortType - 1=relevância, 2=mais vendidos, 3=maior preço, 4=menor preço, 5=maior comissão
 * @param limit    - Quantidade de resultados (máx 50)
 * @returns Lista de produtos encontrados
 */
export async function searchShopeeProductsGraphQL(
  keyword: string,
  sortType: number = 1,
  limit: number = 10,
): Promise<ProductOfferNode[]> {
  // Literal GraphQL seguro (aspas, barras, quebras de linha, unicode).
  // O keyword pode vir do GPT, que leu a legenda de um vídeo de terceiros.
  const safeKeyword = gqlString(keyword);
  // Numéricos: coeridos e limitados, nunca interpolados crus
  const safeSortType = Math.trunc(Number(sortType)) || 1;
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(Number(limit)) || 10));

  // Query em linha única conforme documentação oficial
  // Inclui o campo imageUrl para garantir que a URL da imagem seja retornada
  const query = `query { productOfferV2(keyword: ${safeKeyword}, sortType: ${safeSortType}, limit: ${safeLimit}) { nodes { itemId productName priceMin priceMax sales commissionRate imageUrl offerLink productLink shopName productCatIds ratingStar } pageInfo { page limit hasNextPage } } }`;

  // Erros de transporte/GraphQL lançam ShopeeApiError — não são silenciados
  const response = await graphqlRequest<ProductOfferV2Response>(query);

  const rawNodes = response?.data?.productOfferV2?.nodes ?? [];

  // Normaliza as URLs de imagem para garantir que sejam acessíveis
  const nodes = rawNodes.map((node) => ({
    ...node,
    imageUrl: normalizeImageUrl(node.imageUrl) || "",
  }));

  log.info(`GraphQL retornou ${nodes.length} produtos para "${keyword}" (sortType: ${sortType})`);
  return nodes;
}

/**
 * Gera um link de afiliado encurtado (shope.ee/...).
 *
 * @param originUrl - URL base do produto na Shopee
 * @param subIds    - Tags para rastreamento (opcional, até 5)
 * @returns Link encurtado ou null em caso de falha
 */
export async function generateShortLink(
  originUrl: string,
  subIds?: string[],
): Promise<string | null> {
  const subIdsFormatted = subIds && subIds.length > 0
    ? `, subIds: [${subIds.map(gqlString).join(", ")}]`
    : "";

  const query = `query { generateShortLink(originUrl: ${gqlString(originUrl)}${subIdsFormatted}) { shortLink originalUrl } }`;

  const response = await graphqlRequest<ShortLinkResponse>(query);

  const shortLink = response?.data?.generateShortLink?.shortLink ?? null;
  if (shortLink) {
    log.info(`Link de afiliado gerado: ${shortLink}`);
  } else {
    log.warn(`Falha ao gerar link de afiliado para: ${originUrl}`);
  }
  return shortLink;
}

/**
 * Busca o produto mais relevante para uma keyword na Shopee.
 *
 * Aplica um filtro rigoroso:
 * - Ignora resultados com vendas <= 0 (products without sales history)
 * - Ignora resultados com preço <= 0 (invalid price)
 *
 * Retorna o primeiro resultado válido ou null se nenhum passar no filtro.
 */
export async function findBestShopeeOffer(
  keyword: string,
): Promise<ProductOfferNode | null> {
  const nodes = await searchShopeeProductsGraphQL(keyword, 2, 10);

  if (nodes.length === 0) {
    log.warn(`Nenhum produto encontrado na Shopee para "${keyword}"`);
    return null;
  }

  // Filtro rigoroso: ignora produtos zerados ou com preço inválido
  const valid = nodes.filter((node) => {
    const price = parseFloat(node.priceMin || node.priceMax);
    const hasValidSales = (node.sales ?? 0) > 0;
    const hasValidPrice = !isNaN(price) && price > 0;
    return hasValidSales && hasValidPrice;
  });

  if (valid.length === 0) {
    log.warn(`Todos os produtos para "${keyword}" foram filtrados (vendas <= 0 ou preço <= 0)`);
    return null;
  }

  return valid[0];
}
