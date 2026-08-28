/**
 * Tests: lib/echotik/cron/cleanupOrphans.ts
 *
 * Covers: product detail orphan cleanup, creator blob orphan cleanup,
 * and graceful error handling for blob/DB failures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  // getEchotikConfig lê a tabela Setting; sem linha, cai nos defaults.
  setting: {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
  region: {
    findMany: vi.fn().mockResolvedValue([{ code: "BR" }]),
  },
  echotikProductTrendDaily: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  echotikCreatorTrendDaily: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  echotikVideoTrendDaily: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  echotikProductDetail: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

/** Estado neutro: uma região ativa, nada a podar por região. */
function resetScopeMocks() {
  prismaMock.setting.findUnique.mockResolvedValue(null);
  prismaMock.region.findMany.mockResolvedValue([{ code: "BR" }]);
  prismaMock.echotikProductTrendDaily.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.echotikCreatorTrendDaily.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.echotikCreatorTrendDaily.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.echotikVideoTrendDaily.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.echotikVideoTrendDaily.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.echotikVideoTrendDaily.findMany.mockResolvedValue([]);
}

const deleteBlobsMock = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const listBlobsByPrefixMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("@/lib/storage/blob", () => ({
  deleteBlobs: deleteBlobsMock,
  listBlobsByPrefix: listBlobsByPrefixMock,
}));

import { cleanupOrphanedBlobs } from "@/lib/echotik/cron/cleanupOrphans";

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => log),
  correlationId: "test",
};

// ---------------------------------------------------------------------------
// cleanupOrphanedBlobs — product details
// ---------------------------------------------------------------------------

describe("cleanupOrphanedBlobs() — product details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetScopeMocks();
    // Default: nothing to clean up
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.echotikProductDetail.updateMany.mockResolvedValue({ count: 0 });
    deleteBlobsMock.mockResolvedValue(0);
    listBlobsByPrefixMock.mockResolvedValue([]);
  });

  it("returns zeros when no orphaned product details exist", async () => {
    // All products in trend table match all product detail records
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "prod-1" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);

    const result = await cleanupOrphanedBlobs(log);

    expect(result.productDetailsDeleted).toBe(0);
    expect(result.productBlobsDeleted).toBe(0);
    expect(deleteBlobsMock).not.toHaveBeenCalled();
    expect(prismaMock.echotikProductDetail.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes blob and DB row for orphaned product with blobUrl", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "prod-active" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([
      {
        id: "detail-1",
        productExternalId: "prod-orphan",
        blobUrl: "https://blob.example.com/products/prod-orphan.jpg",
      },
    ]);
    deleteBlobsMock.mockResolvedValue(1);
    prismaMock.echotikProductDetail.deleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupOrphanedBlobs(log);

    expect(result.productBlobsDeleted).toBe(1);
    expect(result.productDetailsDeleted).toBe(1);
    expect(deleteBlobsMock).toHaveBeenCalledWith([
      "https://blob.example.com/products/prod-orphan.jpg",
    ]);
    expect(prismaMock.echotikProductDetail.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["detail-1"] } },
      }),
    );
  });

  it("deletes DB row for orphaned product without blobUrl", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "prod-active" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([
      { id: "detail-2", productExternalId: "prod-orphan", blobUrl: null },
    ]);
    prismaMock.echotikProductDetail.deleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupOrphanedBlobs(log);

    expect(result.productDetailsDeleted).toBe(1);
    expect(result.productBlobsDeleted).toBe(0);
    expect(deleteBlobsMock).not.toHaveBeenCalled();
  });

  it("skips DB deletion when blob deletion throws", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "prod-active" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([
      {
        id: "detail-3",
        productExternalId: "prod-orphan",
        blobUrl: "https://blob.example.com/products/prod-orphan.jpg",
      },
    ]);
    deleteBlobsMock.mockRejectedValue(new Error("Blob API unavailable"));

    const result = await cleanupOrphanedBlobs(log);

    expect(result.productDetailsDeleted).toBe(0);
    expect(result.productBlobsDeleted).toBe(0);
    expect(prismaMock.echotikProductDetail.deleteMany).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("blob deletion failed"),
      expect.any(Object),
    );
  });

  /**
   * Contrato de segurança. Antes, ranking vazio significava "tudo é órfão" —
   * um sync incompleto podia apagar a base inteira e todas as capas. Agora
   * escopo vazio aborta.
   */
  /**
   * A consulta por firstCrawlDt (janela de Novos Produtos) e a consulta de
   * órfãos batem na mesma tabela; o mock precisa separá-las para que "nada a
   * preservar" seja de fato nada.
   */
  function semNadaAPreservar(orfaos: unknown[]) {
    prismaMock.echotikProductDetail.findMany.mockImplementation(
      async (args: any) => (args?.where?.firstCrawlDt ? [] : orfaos),
    );
  }

  it("não apaga nada quando não há produto exibível", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([]);
    semNadaAPreservar([
      { id: "detail-x", productExternalId: "qualquer", blobUrl: null },
    ]);

    const result = await cleanupOrphanedBlobs(log);

    expect(result.productDetailsDeleted).toBe(0);
    expect(prismaMock.echotikProductDetail.deleteMany).not.toHaveBeenCalled();
    expect(deleteBlobsMock).not.toHaveBeenCalled();
  });

  it("não apaga nada quando nenhuma região está ativa", async () => {
    prismaMock.region.findMany.mockResolvedValue([]);
    semNadaAPreservar([
      { id: "detail-y", productExternalId: "qualquer", blobUrl: null },
    ]);

    const result = await cleanupOrphanedBlobs(log);

    expect(result.inactiveRegionRowsDeleted).toBe(0);
    expect(prismaMock.echotikProductTrendDaily.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.echotikProductDetail.deleteMany).not.toHaveBeenCalled();
  });

  /**
   * O caso que quebrava a aba "Novos Produtos": ela lê EchotikProductDetail
   * direto, sem passar pelo ranking. Produto dentro da janela de novos precisa
   * sobreviver mesmo estando fora do top 100.
   */
  it("preserva produto novo que está fora do ranking", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "prod-ranqueado" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockImplementation(
      async (args: any) =>
        args?.where?.firstCrawlDt
          ? [{ productExternalId: "prod-novo" }] // dentro da janela
          : [], // a consulta de órfãos já exclui os preservados
    );

    await cleanupOrphanedBlobs(log);

    const chamadaOrfaos =
      prismaMock.echotikProductDetail.findMany.mock.calls.find(
        (c: any) => c[0]?.where?.productExternalId?.notIn,
      );
    expect(chamadaOrfaos![0].where.productExternalId.notIn).toEqual(
      expect.arrayContaining(["prod-ranqueado", "prod-novo"]),
    );
  });

  it("poda o ranking de regiões desativadas", async () => {
    prismaMock.region.findMany.mockResolvedValue([
      { code: "BR" },
      { code: "US" },
    ]);
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "prod-active" },
    ]);
    prismaMock.echotikProductTrendDaily.deleteMany.mockResolvedValue({ count: 2904 });

    const result = await cleanupOrphanedBlobs(log);

    expect(prismaMock.echotikProductTrendDaily.deleteMany).toHaveBeenCalledWith({
      where: { country: { notIn: ["BR", "US"] } },
    });
    expect(result.inactiveRegionRowsDeleted).toBe(2904);
  });
});

// ---------------------------------------------------------------------------
// cleanupOrphanedBlobs — creator avatars
// ---------------------------------------------------------------------------

describe("cleanupOrphanedBlobs() — creator avatar blobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetScopeMocks();
    // Default: no orphaned product details — isolate creator-only behavior
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "prod-active" },
    ]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.echotikProductDetail.updateMany.mockResolvedValue({ count: 0 });
    deleteBlobsMock.mockResolvedValue(0);
    listBlobsByPrefixMock.mockResolvedValue([]);
  });

  it("returns zero when no creator blobs exist in storage", async () => {
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([
      { userExternalId: "user-1" },
    ]);
    listBlobsByPrefixMock.mockResolvedValue([]);

    const result = await cleanupOrphanedBlobs(log);

    expect(result.creatorBlobsDeleted).toBe(0);
    expect(deleteBlobsMock).not.toHaveBeenCalled();
  });

  it("skips blobs whose userExternalId is still active in trend table", async () => {
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([
      { userExternalId: "user-active" },
    ]);
    listBlobsByPrefixMock.mockResolvedValue([
      {
        url: "https://blob.example.com/creators/user-active.jpg",
        pathname: "creators/user-active.jpg",
      },
    ]);

    const result = await cleanupOrphanedBlobs(log);

    expect(result.creatorBlobsDeleted).toBe(0);
    expect(deleteBlobsMock).not.toHaveBeenCalled();
  });

  it("deletes blob for creator no longer in trend table", async () => {
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([
      { userExternalId: "user-active" },
    ]);
    listBlobsByPrefixMock.mockResolvedValue([
      {
        url: "https://blob.example.com/creators/user-active.jpg",
        pathname: "creators/user-active.jpg",
      },
      {
        url: "https://blob.example.com/creators/user-orphan.jpg",
        pathname: "creators/user-orphan.jpg",
      },
    ]);
    deleteBlobsMock.mockResolvedValue(1);

    const result = await cleanupOrphanedBlobs(log);

    expect(result.creatorBlobsDeleted).toBe(1);
    expect(deleteBlobsMock).toHaveBeenCalledWith([
      "https://blob.example.com/creators/user-orphan.jpg",
    ]);
  });

  it("returns zero and logs warning when listBlobsByPrefix throws", async () => {
    // Precisa de escopo não-vazio para chegar até a listagem — escopo vazio
    // aborta antes, por segurança.
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([
      { userExternalId: "user-active" },
    ]);
    listBlobsByPrefixMock.mockRejectedValue(new Error("Blob list failed"));

    const result = await cleanupOrphanedBlobs(log);

    expect(result.creatorBlobsDeleted).toBe(0);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("creator blobs"),
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// Varredura de capas por prefixo
// ---------------------------------------------------------------------------

/**
 * A limpeza por linha do banco não alcança arquivo sem dono. Em produção isso
 * deixou 1152 de 1167 capas invisíveis à limpeza, enquanto creators/ — que
 * sempre varreu por prefixo — estava zerado. Estes testes travam a simetria.
 */
describe("cleanupOrphanedBlobs() — varredura de capas de produto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetScopeMocks();
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.echotikProductDetail.updateMany.mockResolvedValue({ count: 0 });
    deleteBlobsMock.mockResolvedValue(0);
    listBlobsByPrefixMock.mockResolvedValue([]);
  });

  it("apaga capa sem nenhuma linha apontando para ela", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "ativo-1" },
    ]);
    // Nenhum detalhe no banco — pelo caminho antigo o arquivo era inalcançável
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);
    listBlobsByPrefixMock.mockImplementation(async (prefix: string) =>
      prefix === "products/"
        ? [
            { url: "https://blob/products/ativo-1.jpg", pathname: "products/ativo-1.jpg" },
            { url: "https://blob/products/sumiu.jpg", pathname: "products/sumiu.jpg" },
          ]
        : [],
    );
    deleteBlobsMock.mockResolvedValue(1);

    const result = await cleanupOrphanedBlobs(log);

    expect(deleteBlobsMock).toHaveBeenCalledWith([
      "https://blob/products/sumiu.jpg",
    ]);
    expect(result.productBlobsDeleted).toBe(1);
  });

  it("preserva a capa de produto que ainda está no ranking", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "ativo-1" },
    ]);
    listBlobsByPrefixMock.mockImplementation(async (prefix: string) =>
      prefix === "products/"
        ? [{ url: "https://blob/products/ativo-1.jpg", pathname: "products/ativo-1.jpg" }]
        : [],
    );

    const result = await cleanupOrphanedBlobs(log);

    expect(deleteBlobsMock).not.toHaveBeenCalled();
    expect(result.productBlobsDeleted).toBe(0);
  });

  it("não apaga nada quando o ranking está vazio", async () => {
    // Ranking vazio pode ser sync em andamento — apagar tudo seria catastrófico
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([]);
    listBlobsByPrefixMock.mockImplementation(async (prefix: string) =>
      prefix === "products/"
        ? [{ url: "https://blob/products/qualquer.jpg", pathname: "products/qualquer.jpg" }]
        : [],
    );

    const result = await cleanupOrphanedBlobs(log);

    expect(deleteBlobsMock).not.toHaveBeenCalled();
    expect(result.productBlobsDeleted).toBe(0);
  });

  it("zera o blobUrl das linhas cujo arquivo foi apagado", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "ativo-1" },
    ]);
    listBlobsByPrefixMock.mockImplementation(async (prefix: string) =>
      prefix === "products/"
        ? [{ url: "https://blob/products/sumiu.jpg", pathname: "products/sumiu.jpg" }]
        : [],
    );
    deleteBlobsMock.mockResolvedValue(1);

    await cleanupOrphanedBlobs(log);

    expect(prismaMock.echotikProductDetail.updateMany).toHaveBeenCalledWith({
      where: { blobUrl: { in: ["https://blob/products/sumiu.jpg"] } },
      data: { blobUrl: null },
    });
  });

  it("mantém as linhas quando a exclusão dos arquivos falha", async () => {
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
      { productExternalId: "ativo-1" },
    ]);
    listBlobsByPrefixMock.mockImplementation(async (prefix: string) =>
      prefix === "products/"
        ? [{ url: "https://blob/products/sumiu.jpg", pathname: "products/sumiu.jpg" }]
        : [],
    );
    deleteBlobsMock.mockRejectedValue(new Error("blob store fora do ar"));

    const result = await cleanupOrphanedBlobs(log);

    expect(result.productBlobsDeleted).toBe(0);
    expect(prismaMock.echotikProductDetail.updateMany).not.toHaveBeenCalled();
  });
});
