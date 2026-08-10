/**
 * Tests: trimAchadinhosToTarget (lib/shopee/pipeline.ts)
 *
 * Rotação do feed: o alvo é o TAMANHO do feed, então quando a renovação traz
 * conteúdo novo os publicados mais antigos cedem lugar.
 *
 * A regra que estes testes protegem é a que evita o pior erro possível aqui —
 * esvaziar o feed público. Só READY é arquivado, nunca PENDING: como todo
 * achadinho novo entra em PENDING, o feed só encolhe DEPOIS que um substituto
 * já foi publicado. Arquivar PENDING descartaria trabalho não revisado e
 * poderia deixar o feed menor que o alvo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";

vi.mock("@/lib/prisma");

import { trimAchadinhosToTarget } from "@/lib/shopee/pipeline";

/** Estado do banco: quantos READY existem e quais são os excedentes. */
function publicados(total: number, excedenteIds: string[] = []) {
  (prismaMock.shopeeAchadinhoProduct.count as any).mockResolvedValue(total);
  (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue(
    excedenteIds.map((id) => ({ id })),
  );
  (prismaMock.shopeeAchadinhoProduct.updateMany as any).mockResolvedValue({
    count: excedenteIds.length,
  });
}

beforeEach(() => vi.clearAllMocks());

describe("quando não há excedente", () => {
  it("não arquiva nada estando abaixo do alvo", async () => {
    publicados(80);

    expect(await trimAchadinhosToTarget(100)).toBe(0);
    expect(prismaMock.shopeeAchadinhoProduct.updateMany).not.toHaveBeenCalled();
  });

  it("não arquiva nada estando exatamente no alvo", async () => {
    publicados(100);

    expect(await trimAchadinhosToTarget(100)).toBe(0);
    expect(prismaMock.shopeeAchadinhoProduct.updateMany).not.toHaveBeenCalled();
  });

  it("ignora alvo zero ou negativo", async () => {
    publicados(100);

    expect(await trimAchadinhosToTarget(0)).toBe(0);
    expect(prismaMock.shopeeAchadinhoProduct.count).not.toHaveBeenCalled();
  });
});

describe("quando o feed passou do alvo", () => {
  it("arquiva o excedente", async () => {
    publicados(130, ["a", "b", "c"]);

    expect(await trimAchadinhosToTarget(100)).toBe(3);
    expect(prismaMock.shopeeAchadinhoProduct.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b", "c"] } },
      data: { status: "ARCHIVED" },
    });
  });

  it("mantém os mais recentes e tira os mais antigos", async () => {
    publicados(130, ["velho"]);

    await trimAchadinhosToTarget(100);

    const args = (prismaMock.shopeeAchadinhoProduct.findMany as any).mock.calls.at(-1)[0];
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.skip).toBe(100);
  });

  it("só mexe em READY — nunca no que aguarda revisão", async () => {
    // Arquivar PENDING descartaria trabalho não revisado e poderia derrubar
    // o feed abaixo do alvo antes de existir substituto publicado.
    publicados(130, ["a"]);

    await trimAchadinhosToTarget(100);

    expect(prismaMock.shopeeAchadinhoProduct.count).toHaveBeenCalledWith({
      where: { status: "READY" },
    });
    const args = (prismaMock.shopeeAchadinhoProduct.findMany as any).mock.calls.at(-1)[0];
    expect(args.where).toEqual({ status: "READY" });
  });

  it("usa ARCHIVED, não REJECTED", async () => {
    // Rejeitado é o que o admin recusou e nunca foi ao ar; arquivado foi
    // publicado e saiu por rotação. Misturar sujaria a fila de revisão.
    publicados(130, ["a"]);

    await trimAchadinhosToTarget(100);

    const args = (prismaMock.shopeeAchadinhoProduct.updateMany as any).mock.calls.at(-1)[0];
    expect(args.data.status).toBe("ARCHIVED");
  });
});
