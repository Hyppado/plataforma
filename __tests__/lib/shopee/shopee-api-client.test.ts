/**
 * Tests: lib/shopee/shopee-api-client.ts
 *
 * Caminho que toca dinheiro (links de afiliado) e fronteira com um fornecedor
 * externo. Cobre: assinatura SHA-256, escape de literais GraphQL, propagação
 * de falhas (em vez de resposta vazia silenciosa) e o filtro rigoroso de
 * ofertas.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

const getSecretSetting = vi.fn();
vi.mock("@/lib/settings", () => ({
  getSecretSetting: (...args: unknown[]) => getSecretSetting(...args),
  SETTING_KEYS: {
    SHOPEE_AFFILIATE_APP_ID: "shopee.affiliate_app_id",
    SHOPEE_AFFILIATE_API_SECRET: "shopee.affiliate_api_secret",
  },
}));

import {
  searchShopeeProductsGraphQL,
  generateShortLink,
  findBestShopeeOffer,
  ShopeeApiError,
} from "@/lib/shopee/shopee-api-client";

const APP_ID = "test-app-id";
const APP_SECRET = "test-app-secret";

function node(overrides: Record<string, unknown> = {}) {
  return {
    itemId: "123",
    productName: "Fone de Ouvido",
    priceMin: "49.90",
    priceMax: "59.90",
    sales: 100,
    commissionRate: "8.5",
    imageUrl: "https://down-br.img.susercontent.com/file/abc.jpg",
    offerLink: "https://shopee.com.br/product/123",
    productLink: "https://shopee.com.br/product/123",
    shopName: "Loja",
    productCatIds: [100632],
    ratingStar: "4.8",
    ...overrides,
  };
}

/** Resposta HTTP 200 com corpo JSON. */
function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function productResponse(nodes: unknown[]) {
  return okResponse({ data: { productOfferV2: { nodes } } });
}

/** Último corpo enviado ao fetch, já parseado. */
function lastRequestBody() {
  const call = (globalThis.fetch as any).mock.calls.at(-1);
  return JSON.parse(call[1].body);
}

function lastAuthHeader(): string {
  const call = (globalThis.fetch as any).mock.calls.at(-1);
  return call[1].headers.Authorization;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSecretSetting.mockImplementation(async (key: string) =>
    key === "shopee.affiliate_app_id" ? APP_ID : APP_SECRET,
  );
});

describe("autenticação SHA-256", () => {
  it("assina appId + timestamp + payload + secret, nessa ordem", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(productResponse([])));

    await searchShopeeProductsGraphQL("perfume");

    const header = lastAuthHeader();
    const timestamp = /Timestamp=(\d+)/.exec(header)?.[1];
    const signature = /Signature=([a-f0-9]+)/.exec(header)?.[1];
    const payload = JSON.stringify(lastRequestBody());

    expect(timestamp).toBeTruthy();

    const expected = crypto
      .createHash("sha256")
      .update(`${APP_ID}${timestamp}${payload}${APP_SECRET}`)
      .digest("hex");

    expect(signature).toBe(expected);
  });

  it("falha quando as credenciais não estão configuradas", async () => {
    getSecretSetting.mockResolvedValue("");
    vi.stubGlobal("fetch", vi.fn());

    await expect(searchShopeeProductsGraphQL("perfume")).rejects.toThrow(
      /credenciais/i,
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("escape de literais GraphQL", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(productResponse([])));
  });

  it("escapa aspas no keyword", async () => {
    await searchShopeeProductsGraphQL('fone "premium"');

    const { query } = lastRequestBody();
    expect(query).toContain('"fone \\"premium\\""');
  });

  it("escapa barra invertida — quebrava a query no escape antigo", async () => {
    await searchShopeeProductsGraphQL("fone \\ premium");

    const { query } = lastRequestBody();
    // Precisa ser um literal JSON/GraphQL válido
    expect(() => JSON.parse(/keyword: ("(?:[^"\\]|\\.)*")/.exec(query)![1])).not.toThrow();
  });

  it("escapa quebras de linha", async () => {
    await searchShopeeProductsGraphQL("fone\nbluetooth");

    const { query } = lastRequestBody();
    expect(query).not.toContain("\n");
    expect(query).toContain("\\n");
  });

  it("mantém tentativa de injeção CONTIDA dentro do literal", async () => {
    // Tentativa de fechar a string e emendar outra seleção.
    // O texto malicioso pode aparecer no payload — o que importa é que ele
    // continue DENTRO do literal, como dado inerte, sem virar sintaxe.
    const malicious = 'x") { __typename } evil(k: "';
    await searchShopeeProductsGraphQL(malicious);

    const { query } = lastRequestBody();

    // Extrai o literal que segue `keyword: ` respeitando escapes
    const literal = /keyword: ("(?:[^"\\]|\\.)*")/.exec(query)?.[1];
    expect(literal).toBeTruthy();

    // Se nada escapou, o literal desserializa exatamente no input original
    expect(JSON.parse(literal!)).toBe(malicious);

    // E a estrutura da query segue intacta logo após o literal
    expect(query.slice(query.indexOf(literal!) + literal!.length)).toMatch(
      /^, sortType: \d+, limit: \d+\)/,
    );
  });

  it("coerce sortType e limita o limit", async () => {
    await searchShopeeProductsGraphQL("perfume", 2, 9999);

    const { query } = lastRequestBody();
    expect(query).toContain("sortType: 2");
    expect(query).toContain("limit: 50");
  });

  it("escapa subIds e originUrl em generateShortLink", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okResponse({ data: { generateShortLink: { shortLink: "https://shope.ee/x" } } }),
      ),
    );

    await generateShortLink('https://shopee.com.br/p?q="1"', ['tag"1']);

    const { query } = lastRequestBody();
    expect(query).toContain('\\"');
    expect(query).toContain("subIds:");
  });
});

describe("propagação de falhas", () => {
  it("lança em erro HTTP em vez de devolver vazio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      }),
    );

    await expect(searchShopeeProductsGraphQL("perfume")).rejects.toBeInstanceOf(
      ShopeeApiError,
    );
  });

  it("expõe o status HTTP no erro", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Too Many Requests",
      }),
    );

    await expect(searchShopeeProductsGraphQL("perfume")).rejects.toMatchObject({
      status: 429,
    });
  });

  it("lança em falha de rede", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    await expect(searchShopeeProductsGraphQL("perfume")).rejects.toThrow(
      /rede/i,
    );
  });

  it("lança quando o envelope GraphQL traz errors, mesmo com HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okResponse({ errors: [{ message: "invalid signature" }] }),
      ),
    );

    await expect(searchShopeeProductsGraphQL("perfume")).rejects.toThrow(
      /invalid signature/,
    );
  });

  it("lista vazia NÃO é erro — busca legítima sem resultados", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(productResponse([])));

    await expect(searchShopeeProductsGraphQL("xyz")).resolves.toEqual([]);
  });
});

describe("normalização de imagem", () => {
  it("converte http em https", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        productResponse([node({ imageUrl: "http://cdn.shopee.com.br/a.jpg" })]),
      ),
    );

    const [result] = await searchShopeeProductsGraphQL("perfume");
    expect(result.imageUrl).toBe("https://cdn.shopee.com.br/a.jpg");
  });

  it("resolve caminho relativo no CDN da Shopee", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(productResponse([node({ imageUrl: "/file/abc.jpg" })])),
    );

    const [result] = await searchShopeeProductsGraphQL("perfume");
    expect(result.imageUrl).toBe("https://down-br.img.susercontent.com/file/abc.jpg");
  });

  it("prefixa https em URL protocol-relative", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(productResponse([node({ imageUrl: "//cdn/a.jpg" })])),
    );

    const [result] = await searchShopeeProductsGraphQL("perfume");
    expect(result.imageUrl).toBe("https://cdn/a.jpg");
  });
});

describe("findBestShopeeOffer — filtro rigoroso", () => {
  it("descarta ofertas sem vendas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(productResponse([node({ sales: 0 })])),
    );

    await expect(findBestShopeeOffer("perfume")).resolves.toBeNull();
  });

  it("descarta ofertas com preço zero ou inválido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        productResponse([
          node({ priceMin: "0", priceMax: "0" }),
          node({ itemId: "2", priceMin: "abc", priceMax: "" }),
        ]),
      ),
    );

    await expect(findBestShopeeOffer("perfume")).resolves.toBeNull();
  });

  it("devolve a primeira oferta válida", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        productResponse([
          node({ itemId: "ruim", sales: 0 }),
          node({ itemId: "boa", sales: 42 }),
        ]),
      ),
    );

    const offer = await findBestShopeeOffer("perfume");
    expect(offer?.itemId).toBe("boa");
  });

  it("devolve null quando não há resultados", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(productResponse([])));

    await expect(findBestShopeeOffer("inexistente")).resolves.toBeNull();
  });

  it("busca por mais vendidos (sortType 2)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(productResponse([])));

    await findBestShopeeOffer("perfume");

    expect(lastRequestBody().query).toContain("sortType: 2");
  });

  it("propaga indisponibilidade da API — não finge 'sem resultados'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }),
    );

    await expect(findBestShopeeOffer("perfume")).rejects.toBeInstanceOf(
      ShopeeApiError,
    );
  });
});
