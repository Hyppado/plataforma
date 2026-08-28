/**
 * Tests: app/api/trending/new-products/route.ts
 *
 * A tela anuncia "produtos novos nos últimos N dias", mas a consulta filtrava
 * só por região. Como o ranking e os novos produtos dividem a mesma tabela de
 * detalhes, ela exibia produto de um ano atrás como novo — e sem capa, porque
 * o job de imagem cobre o que é exibível (ranking + janela de novos) e esses
 * não estavam em nenhum dos dois.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makeGetRequest,
} from "@tests/helpers/auth";

vi.mock("@/lib/prisma");

vi.mock("@/lib/access/resolver", () => ({
  resolveUserAccess: vi.fn().mockResolvedValue({ status: "FULL_ACCESS" }),
}));

vi.mock("@/lib/echotik/cron/config", () => ({
  getEchotikConfig: vi.fn().mockResolvedValue({ newProducts: { daysBack: 3 } }),
}));

import { GET } from "@/app/api/trending/new-products/route";

beforeEach(() => {
  vi.clearAllMocks();
  (prismaMock.echotikProductDetail.findMany as any).mockResolvedValue([]);
  (prismaMock.echotikProductDetail.count as any).mockResolvedValue(0);
});

describe("GET /api/trending/new-products", () => {
  it("rejeita não autenticado", async () => {
    mockUnauthenticated();
    const res = await GET(makeGetRequest("/api/trending/new-products") as any);
    expect(res.status).toBe(401);
  });

  /** O filtro é o que separa "novo" de "qualquer detalhe já gravado". */
  it("filtra pela janela de dias que a tela anuncia", async () => {
    mockAuthenticatedUser();

    await GET(
      makeGetRequest("/api/trending/new-products", { region: "BR" }) as any,
    );

    const where = (prismaMock.echotikProductDetail.findMany as any).mock
      .calls[0][0].where;
    expect(where.region).toBe("BR");
    expect(where.firstCrawlDt?.gte).toBeTypeOf("number");
  });

  /**
   * A data de corte é AAAAMMDD como inteiro, formato de `first_crawl_dt` na
   * EchoTik — comparar com timestamp devolveria o conjunto errado.
   */
  it("usa o corte no formato AAAAMMDD", async () => {
    mockAuthenticatedUser();

    await GET(
      makeGetRequest("/api/trending/new-products", { region: "BR" }) as any,
    );

    const corte = (prismaMock.echotikProductDetail.findMany as any).mock
      .calls[0][0].where.firstCrawlDt.gte as number;
    expect(corte).toBeGreaterThan(20000101);
    expect(corte).toBeLessThan(30000101);
  });

  it("conta o total dentro da mesma janela", async () => {
    mockAuthenticatedUser();

    await GET(
      makeGetRequest("/api/trending/new-products", { region: "BR" }) as any,
    );

    const whereLista = (prismaMock.echotikProductDetail.findMany as any).mock
      .calls[0][0].where;
    const whereTotal = (prismaMock.echotikProductDetail.count as any).mock
      .calls[0][0].where;
    // Total maior que a lista faria a paginação prometer páginas vazias.
    expect(whereTotal).toEqual(whereLista);
  });
});
