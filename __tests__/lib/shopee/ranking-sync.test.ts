/**
 * Tests: lib/shopee/client.ts — syncShopeeRankings
 *
 * O ranking é reconstruído do zero a cada execução, então uma falha do
 * fornecedor pode destruir dados bons. Estes testes travam as três proteções:
 * nunca apagar sem substituto, troca atômica, e guarda de encolhimento.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";

vi.mock("@/lib/prisma");

const searchShopeeProductsGraphQL = vi.fn();
vi.mock("@/lib/shopee/shopee-api-client", () => ({
  searchShopeeProductsGraphQL: (...args: unknown[]) =>
    searchShopeeProductsGraphQL(...args),
}));

vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn().mockResolvedValue(null),
  SETTING_KEYS: { SHOPEE_RANKING_LIMIT: "shopee.ranking_limit" },
}));

import { syncShopeeRankings } from "@/lib/shopee/client";

function offerNode(id: string, sales = 10) {
  return {
    itemId: id,
    productName: `Produto ${id}`,
    priceMin: "49.90",
    priceMax: "59.90",
    sales,
    commissionRate: "8.5",
    imageUrl: "https://cdn/img.jpg",
    offerLink: `https://shopee.com.br/product/${id}`,
    productLink: `https://shopee.com.br/product/${id}`,
    shopName: "Loja",
    productCatIds: [100632],
    ratingStar: "4.8",
  };
}

/** Captura as operações passadas ao $transaction. */
function mockTransaction() {
  (prismaMock.$transaction as any).mockImplementation(async (ops: unknown[]) => [
    { count: 0 },
    { count: Array.isArray(ops) ? 1 : 1 },
  ]);
}

describe("syncShopeeRankings — proteção contra perda de dados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prismaMock.shopeeProductTrend.count as any).mockResolvedValue(0);
  });

  it("NÃO apaga o ranking quando a API não devolve nada", async () => {
    searchShopeeProductsGraphQL.mockResolvedValue([]);

    await expect(syncShopeeRankings()).rejects.toThrow(
      /não devolveu nenhum produto/i,
    );

    // O ponto central: nada foi apagado
    expect(prismaMock.shopeeProductTrend.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("NÃO apaga o ranking quando todas as keywords falham", async () => {
    searchShopeeProductsGraphQL.mockRejectedValue(new Error("502 Bad Gateway"));

    await expect(syncShopeeRankings()).rejects.toThrow();

    expect(prismaMock.shopeeProductTrend.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("propaga o erro em vez de retornar 0 — o run precisa ficar FAILED", async () => {
    // Retornar 0 marcaria SUCCESS e iniciaria o cooldown de 24h, bloqueando
    // a retentativa durante uma indisponibilidade do fornecedor.
    searchShopeeProductsGraphQL.mockResolvedValue([]);

    await expect(syncShopeeRankings()).rejects.toBeInstanceOf(Error);
  });

  it("aborta a substituição quando o conjunto novo encolhe demais", async () => {
    // 50 produtos atuais; a maioria das keywords falha e sobram poucos
    (prismaMock.shopeeProductTrend.count as any).mockResolvedValue(50);
    searchShopeeProductsGraphQL
      .mockResolvedValueOnce([offerNode("a"), offerNode("b")])
      .mockRejectedValue(new Error("timeout"));

    await expect(syncShopeeRankings()).rejects.toThrow(
      /muito menor que o atual/i,
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("permite encolhimento legítimo quando nenhuma keyword falhou", async () => {
    (prismaMock.shopeeProductTrend.count as any).mockResolvedValue(50);
    searchShopeeProductsGraphQL.mockResolvedValue([offerNode("a")]);
    mockTransaction();

    await expect(syncShopeeRankings()).resolves.toBeGreaterThanOrEqual(0);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

describe("syncShopeeRankings — troca atômica", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prismaMock.shopeeProductTrend.count as any).mockResolvedValue(0);
  });

  it("faz delete + create numa única transação", async () => {
    searchShopeeProductsGraphQL.mockResolvedValue([
      offerNode("a", 100),
      offerNode("b", 50),
    ]);
    mockTransaction();

    await syncShopeeRankings();

    // Nunca um deleteMany solto — sempre dentro do $transaction
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const ops = (prismaMock.$transaction as any).mock.calls[0][0];
    expect(Array.isArray(ops)).toBe(true);
    expect(ops).toHaveLength(2);
  });

  it("usa createMany em vez de N upserts", async () => {
    searchShopeeProductsGraphQL.mockResolvedValue([offerNode("a")]);
    mockTransaction();

    await syncShopeeRankings();

    expect(prismaMock.shopeeProductTrend.createMany).toHaveBeenCalled();
    expect(prismaMock.shopeeProductTrend.upsert).not.toHaveBeenCalled();
  });

  it("ordena por vendas decrescente e numera rankPosition a partir de 1", async () => {
    searchShopeeProductsGraphQL.mockResolvedValueOnce([
      offerNode("baixo", 5),
      offerNode("alto", 900),
      offerNode("medio", 100),
    ]);
    searchShopeeProductsGraphQL.mockResolvedValue([]);
    mockTransaction();

    await syncShopeeRankings();

    const createArgs = (prismaMock.shopeeProductTrend.createMany as any).mock
      .calls[0][0];
    const rows = createArgs.data;

    expect(rows[0].productExternalId).toBe("alto");
    expect(rows[0].rankPosition).toBe(1);
    expect(rows[1].productExternalId).toBe("medio");
    expect(rows[1].rankPosition).toBe(2);
    expect(rows[2].productExternalId).toBe("baixo");
    expect(rows[2].rankPosition).toBe(3);
  });

  it("deduplica por itemId entre keywords", async () => {
    searchShopeeProductsGraphQL.mockResolvedValue([offerNode("mesmo", 10)]);
    mockTransaction();

    await syncShopeeRankings();

    const rows = (prismaMock.shopeeProductTrend.createMany as any).mock
      .calls[0][0].data;
    expect(rows).toHaveLength(1);
  });

  it("continua apesar de falha isolada de keyword", async () => {
    searchShopeeProductsGraphQL
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue([offerNode("ok", 10)]);
    mockTransaction();

    const result = await syncShopeeRankings();

    expect(result).toBeGreaterThanOrEqual(0);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});
