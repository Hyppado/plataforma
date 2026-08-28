/**
 * Tests: app/api/shopee/ranking/route.ts
 *
 * Rota fina, mas era o último handler Shopee sem cobertura. Cobre a guarda de
 * autenticação, a ordenação por posição e o tratamento de erro.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockUnauthenticated,
  makeGetRequest,
} from "@tests/helpers/auth";

vi.mock("@/lib/prisma");

import { GET } from "@/app/api/shopee/ranking/route";

const PRODUTO = {
  id: "t1",
  productExternalId: "shopee-1",
  productName: "Fone",
  rankPosition: 1,
  price: 49.9,
  commissionRate: 8.5,
  saleCount: 100,
  gmv: 4990,
  rating: 4.8,
};

beforeEach(() => {
  vi.clearAllMocks();
  // A rota monta a árvore de categorias a partir da dimensão oficial.
  // O mock compartilhado devolve null por padrão, que o findMany real nunca
  // devolve.
  (prismaMock.shopeeCategory.findMany as any).mockResolvedValue([]);
});

describe("GET /api/shopee/ranking", () => {
  it("rejeita não autenticado", async () => {
    mockUnauthenticated();
    const res = await GET(makeGetRequest("/api/shopee/ranking") as any);
    expect(res.status).toBe(401);
  });

  it("devolve os produtos para usuário autenticado", async () => {
    mockAuthenticatedUser();
    (prismaMock.shopeeProductTrend.findMany as any).mockResolvedValue([PRODUTO]);

    const res = await GET(makeGetRequest("/api/shopee/ranking") as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.products).toHaveLength(1);
  });

  it("ordena por posição no ranking (asc)", async () => {
    mockAuthenticatedUser();
    (prismaMock.shopeeProductTrend.findMany as any).mockResolvedValue([]);

    await GET(makeGetRequest("/api/shopee/ranking") as any);

    const args = (prismaMock.shopeeProductTrend.findMany as any).mock.calls[0][0];
    expect(args.orderBy).toEqual({ rankPosition: "asc" });
  });

  it("devolve lista vazia sem quebrar quando não há ranking", async () => {
    mockAuthenticatedUser();
    (prismaMock.shopeeProductTrend.findMany as any).mockResolvedValue([]);

    const body = await (await GET(makeGetRequest("/api/shopee/ranking") as any)).json();
    expect(body.products).toEqual([]);
  });

  it("devolve 500 com mensagem quando o banco falha", async () => {
    mockAuthenticatedUser();
    (prismaMock.shopeeProductTrend.findMany as any).mockRejectedValue(
      new Error("conexão perdida"),
    );

    const res = await GET(makeGetRequest("/api/shopee/ranking") as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("conexão perdida");
  });
});
