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
