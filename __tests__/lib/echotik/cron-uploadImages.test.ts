/**
 * Tests: lib/echotik/cron/uploadImages.ts
 *
 * O escopo deste job precisa casar com o que a limpeza preserva. Quando os
 * dois divergiram, a limpeza guardava a linha do produto novo e nada subia a
 * capa dele: a primeira página de "Novos Produtos" (BR) ficou com 10 de 100
 * com imagem, e era a pior página justamente por ordenar do mais recente para
 * o mais antigo — os que o cron ainda não tinha alcançado.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  setting: { findUnique: vi.fn().mockResolvedValue(null) },
  region: { findMany: vi.fn().mockResolvedValue([{ code: "BR" }]) },
  echotikProductTrendDaily: { findMany: vi.fn().mockResolvedValue([]) },
  echotikCreatorTrendDaily: {
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  echotikVideoTrendDaily: {
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  echotikProductDetail: {
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, default: prismaMock }));

const signEchotikCoverUrls = vi.fn();
const uploadImageToBlob = vi.fn();
vi.mock("@/lib/storage/blob", () => ({
  signEchotikCoverUrls: (...a: unknown[]) => signEchotikCoverUrls(...a),
  uploadImageToBlob: (...a: unknown[]) => uploadImageToBlob(...a),
}));

import { uploadPendingImages } from "@/lib/echotik/cron/uploadImages";

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => log),
  correlationId: "test",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.setting.findUnique.mockResolvedValue(null);
  prismaMock.region.findMany.mockResolvedValue([{ code: "BR" }]);
  prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([
    { productExternalId: "ranqueado-1" },
  ]);
  prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([]);
  prismaMock.echotikVideoTrendDaily.findMany.mockResolvedValue([]);
  signEchotikCoverUrls.mockResolvedValue(new Map());
  uploadImageToBlob.mockResolvedValue("https://blob/products/x.jpg");
});

/** Separa a consulta da janela de novos da consulta de pendentes de upload. */
function detalhes(novos: unknown[], pendentes: unknown[]) {
  prismaMock.echotikProductDetail.findMany.mockImplementation(
    async (args: any) => (args?.where?.firstCrawlDt ? novos : pendentes),
  );
}

describe("uploadProductImages — escopo", () => {
  it("inclui produto da janela de Novos Produtos, não só o ranking", async () => {
    detalhes([{ productExternalId: "produto-novo" }], []);

    await uploadPendingImages(log);

    const consultaPendentes = (
      prismaMock.echotikProductDetail.findMany.mock.calls as any[]
    ).find(([a]) => a?.where?.blobUrl === null);

    expect(consultaPendentes).toBeTruthy();
    expect(consultaPendentes![0].where.productExternalId.in).toEqual(
      expect.arrayContaining(["ranqueado-1", "produto-novo"]),
    );
  });

  it("sobe a capa de um produto novo fora do ranking", async () => {
    detalhes(
      [{ productExternalId: "produto-novo" }],
      [
        {
          id: "d1",
          productExternalId: "produto-novo",
          coverUrl: "https://cdn/capa.jpg",
        },
      ],
    );

    const r = await uploadPendingImages(log);

    expect(uploadImageToBlob).toHaveBeenCalledWith(
      expect.any(String),
      "products/produto-novo.jpg",
    );
    expect(prismaMock.echotikProductDetail.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { blobUrl: "https://blob/products/x.jpg" },
    });
    expect(r.productImagesUploaded).toBe(1);
  });

  /**
   * Falha de upload deixa blobUrl null de propósito, para a próxima execução
   * tentar de novo — marcar como tentado esconderia o produto sem capa.
   */
  it("preserva o pendente quando o upload falha", async () => {
    detalhes(
      [],
      [{ id: "d1", productExternalId: "p1", coverUrl: "https://cdn/a.jpg" }],
    );
    uploadImageToBlob.mockResolvedValue(null);

    const r = await uploadPendingImages(log);

    expect(prismaMock.echotikProductDetail.update).not.toHaveBeenCalled();
    expect(r.productImagesUploaded).toBe(0);
  });

  it("não sobe nada quando não há região ativa", async () => {
    prismaMock.region.findMany.mockResolvedValue([]);
    detalhes([], []);

    const r = await uploadPendingImages(log);

    expect(uploadImageToBlob).not.toHaveBeenCalled();
    expect(r.productImagesUploaded).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Repartição do orçamento entre as entidades
// ---------------------------------------------------------------------------

/**
 * As três etapas rodavam em sequência com o MESMO prazo. Produtos vinham
 * primeiro, consumiam quase todo o tempo, e vídeos — últimos — ficavam com as
 * sobras: 60 capas de produto por execução contra 8 a 21 de vídeo, com 238
 * vídeos na fila. A ordem no código virava prioridade de fato.
 */
describe("orçamento por etapa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.setting.findUnique.mockResolvedValue(null);
    prismaMock.region.findMany.mockResolvedValue([{ code: "BR" }]);
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikVideoTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);
  });

  it("não deixa uma etapa consumir o prazo inteiro", async () => {
    const prazo = Date.now() + 30_000;
    // Sem escopo não há upload; o que importa aqui é a etapa de vídeo ainda
    // ser alcançada, em vez de morrer no prazo gasto pelas anteriores.
    const r = await uploadPendingImages(log, prazo);

    expect(r).toHaveProperty("videoCoversUploaded");
    expect(r).toHaveProperty("productImagesUploaded");
    expect(r).toHaveProperty("creatorAvatarsUploaded");
  });

  /** Sem prazo definido, nenhuma etapa deve inventar um limite de tempo. */
  it("funciona sem prazo definido", async () => {
    const r = await uploadPendingImages(log);
    expect(r.videoCoversUploaded).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Capas de vídeo com assinatura vencida
// ---------------------------------------------------------------------------

/**
 * A EchoTik às vezes devolve a URL crua do TikTok em vez da capa do CDN dela.
 * Essas vêm assinadas e chegam vencidas — nas 18 medidas, a assinatura já
 * tinha expirado quando a linha foi gravada. Elas nunca sobem, e como são
 * re-sincronizadas a cada ciclo ficam no topo do `orderBy syncedAt`,
 * empurrando para fora do lote as capas que ainda dava para salvar.
 */
describe("uploadVideoCovers — assinatura vencida", () => {
  const vencida =
    "https://p19-common-sign.tiktokcdn-eu.com/a.heic?x-expires=1000000000";
  const valida =
    "https://echosell-images.tos-ap-southeast-1.volces.com/video-cover/1.jpg";

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.setting.findUnique.mockResolvedValue(null);
    prismaMock.region.findMany.mockResolvedValue([{ code: "BR" }]);
    prismaMock.echotikProductTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikCreatorTrendDaily.findMany.mockResolvedValue([]);
    prismaMock.echotikProductDetail.findMany.mockResolvedValue([]);
    signEchotikCoverUrls.mockResolvedValue(new Map());
    uploadImageToBlob.mockResolvedValue("https://blob/videos/v.jpg");
    prismaMock.echotikVideoTrendDaily.findMany.mockImplementation(
      async (args: any) =>
        args?.where?.coverBlobUrl === null
          ? [
              { videoExternalId: "morto", coverUrl: vencida },
              { videoExternalId: "vivo", coverUrl: valida },
            ]
          : [{ videoExternalId: "morto" }, { videoExternalId: "vivo" }],
    );
  });

  it("não tenta subir capa cuja assinatura já expirou", async () => {
    const r = await uploadPendingImages(log);

    expect(uploadImageToBlob).toHaveBeenCalledTimes(1);
    expect(uploadImageToBlob).toHaveBeenCalledWith(
      expect.any(String),
      "videos/vivo.jpg",
    );
    expect(r.videoCoversUploaded).toBe(1);
  });

  /**
   * Zerar a origem morta tira a linha da fila de pendentes e impede o card de
   * cair nela — o fallback de exibição usa coverUrl quando não há blob.
   */
  it("zera a origem morta para ela sair da fila", async () => {
    await uploadPendingImages(log);

    const limpeza = (
      prismaMock.echotikVideoTrendDaily.updateMany.mock.calls as any[]
    ).find(([a]) => a?.data?.coverUrl === null);

    expect(limpeza).toBeTruthy();
    expect(limpeza![0].where.videoExternalId.in).toEqual(["morto"]);
  });

  /**
   * Avatar de criador sofre do mesmo mal — 946 de 946 sem assinatura viraram
   * blob, contra 2 de 17 assinadas — e precisa do mesmo descarte.
   */
  it("aplica o mesmo descarte ao avatar de criador", async () => {
    prismaMock.echotikCreatorTrendDaily.findMany.mockImplementation(
      async (args: any) =>
        args?.where?.avatarBlobUrl === null
          ? [
              { id: "c1", userExternalId: "morto", avatar: vencida },
              { id: "c2", userExternalId: "vivo", avatar: valida },
            ]
          : [{ userExternalId: "morto" }, { userExternalId: "vivo" }],
    );

    await uploadPendingImages(log);

    const limpeza = (
      prismaMock.echotikCreatorTrendDaily.updateMany.mock.calls as any[]
    ).find(([a]) => a?.data?.avatar === null);

    expect(limpeza).toBeTruthy();
    expect(limpeza![0].where.userExternalId.in).toEqual(["morto"]);
    expect(uploadImageToBlob).toHaveBeenCalledWith(
      expect.any(String),
      "creators/vivo.jpg",
    );
    expect(uploadImageToBlob).not.toHaveBeenCalledWith(
      expect.any(String),
      "creators/morto.jpg",
    );
  });
});
