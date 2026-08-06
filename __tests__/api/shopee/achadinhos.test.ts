/**
 * Tests: app/api/shopee/achadinhos — gate de aprovação
 *
 * Cobre a regra central do gate: o pipeline grava PENDING e NADA aparece para
 * o usuário final até um admin aprovar (PENDING -> READY).
 *
 * Coverage: visibilidade por papel, escalonamento via ?status, ações de
 * revisão, transições proibidas, serialização de BigInt.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  makeGetRequest,
  makePatchRequest,
} from "@tests/helpers/auth";

vi.mock("@/lib/prisma");

import { GET } from "@/app/api/shopee/achadinhos/route";
import { PATCH } from "@/app/api/shopee/achadinhos/[id]/route";

/** Registro mínimo de achadinho para os mocks do Prisma. */
function buildAchadinho(overrides: Record<string, unknown> = {}) {
  return {
    id: "ach-1",
    videoExternalId: "7300000000000000000",
    videoUrl: "https://www.tiktok.com/@alguem/video/7300000000000000000",
    videoTitle: "achadinho top",
    coverUrl: null,
    transcriptText: "texto",
    productName: "fone de ouvido bluetooth",
    category: "Eletrônicos",
    affiliateLink: "https://shope.ee/abc123",
    originalAffLink: "https://shopee.com.br/product/1",
    price: 49.9,
    saleCount: 120,
    commission: 8.5,
    views: BigInt(1_500_000),
    authorName: "alguem",
    status: "PENDING",
    errorMessage: null,
    productImageUrl: null,
    productPriceMin: 49.9,
    productPriceMax: 59.9,
    productLink: "https://shopee.com.br/product/1",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

/** Extrai o `where` usado na consulta principal de achadinhos. */
function findManyWhere() {
  return (prismaMock.shopeeAchadinhoProduct.findMany as any).mock.calls[0][0]
    .where;
}

function mockFeedQueries(rows = [buildAchadinho()]) {
  (prismaMock.shopeeAchadinhoProduct.findMany as any)
    .mockResolvedValueOnce(rows) // página de resultados
    .mockResolvedValueOnce([{ category: "Eletrônicos" }]); // categorias
  (prismaMock.shopeeAchadinhoProduct.count as any).mockResolvedValue(rows.length);
}

describe("GET /api/shopee/achadinhos — visibilidade", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 para não autenticado", async () => {
    mockUnauthenticated();
    const res = await GET(makeGetRequest("/api/shopee/achadinhos") as any);
    expect(res.status).toBe(401);
  });

  it("usuário final vê apenas achadinhos aprovados (READY)", async () => {
    mockAuthenticatedUser();
    mockFeedQueries();

    const res = await GET(makeGetRequest("/api/shopee/achadinhos") as any);

    expect(res.status).toBe(200);
    expect(findManyWhere().status).toBe("READY");
  });

  it("usuário final NÃO escapa do gate passando ?status=all", async () => {
    mockAuthenticatedUser();
    mockFeedQueries();

    await GET(
      makeGetRequest("/api/shopee/achadinhos", { status: "all" }) as any,
    );

    // O parâmetro é ignorado — continua preso em READY
    expect(findManyWhere().status).toBe("READY");
  });

  it("usuário final NÃO escapa do gate pedindo PENDING explicitamente", async () => {
    mockAuthenticatedUser();
    mockFeedQueries();

    await GET(
      makeGetRequest("/api/shopee/achadinhos", { status: "PENDING" }) as any,
    );

    expect(findManyWhere().status).toBe("READY");
  });

  it("admin sem ?status também vê apenas READY (mesma visão do usuário)", async () => {
    mockAuthenticatedAdmin();
    mockFeedQueries();

    await GET(makeGetRequest("/api/shopee/achadinhos") as any);

    expect(findManyWhere().status).toBe("READY");
  });

  it("admin com ?status=all vê a fila inteira", async () => {
    mockAuthenticatedAdmin();
    mockFeedQueries();

    await GET(
      makeGetRequest("/api/shopee/achadinhos", { status: "all" }) as any,
    );

    expect(findManyWhere().status).toBeUndefined();
  });

  it("admin pode filtrar por um status específico", async () => {
    mockAuthenticatedAdmin();
    mockFeedQueries();

    await GET(
      makeGetRequest("/api/shopee/achadinhos", { status: "REJECTED" }) as any,
    );

    expect(findManyWhere().status).toBe("REJECTED");
  });

  it("admin recebe 400 para status desconhecido", async () => {
    mockAuthenticatedAdmin();

    const res = await GET(
      makeGetRequest("/api/shopee/achadinhos", { status: "BANANA" }) as any,
    );

    expect(res.status).toBe(400);
  });

  it("a lista de categorias respeita a mesma visibilidade", async () => {
    mockAuthenticatedUser();
    mockFeedQueries();

    await GET(makeGetRequest("/api/shopee/achadinhos") as any);

    const categoriasWhere = (prismaMock.shopeeAchadinhoProduct.findMany as any)
      .mock.calls[1][0].where;
    expect(categoriasWhere.status).toBe("READY");
  });

  it("serializa views (BigInt) como number", async () => {
    mockAuthenticatedUser();
    mockFeedQueries([buildAchadinho({ status: "READY" })]);

    const res = await GET(makeGetRequest("/api/shopee/achadinhos") as any);
    const body = await res.json();

    expect(body.achadinhos[0].views).toBe(1_500_000);
    expect(typeof body.achadinhos[0].views).toBe("number");
  });
});

describe("PATCH /api/shopee/achadinhos/[id] — revisão", () => {
  const params = { params: { id: "ach-1" } };

  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 para não autenticado", async () => {
    mockUnauthenticated();
    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      action: "approve",
    });
    const res = await PATCH(req as any, params);
    expect(res.status).toBe(401);
  });

  it("retorna 403 para usuário não-admin", async () => {
    mockAuthenticatedUser();
    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      action: "approve",
    });
    const res = await PATCH(req as any, params);
    expect(res.status).toBe(403);
  });

  it("aprovar move PENDING -> READY", async () => {
    mockAuthenticatedAdmin();
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(
      buildAchadinho({ status: "PENDING" }),
    );
    (prismaMock.shopeeAchadinhoProduct.update as any).mockResolvedValue(
      buildAchadinho({ status: "READY" }),
    );

    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      action: "approve",
    });
    const res = await PATCH(req as any, params);

    expect(res.status).toBe(200);
    const updateArgs = (prismaMock.shopeeAchadinhoProduct.update as any).mock
      .calls[0][0];
    expect(updateArgs.data.status).toBe("READY");
  });

  it("rejeitar move READY -> REJECTED (despublica)", async () => {
    mockAuthenticatedAdmin();
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(
      buildAchadinho({ status: "READY" }),
    );
    (prismaMock.shopeeAchadinhoProduct.update as any).mockResolvedValue(
      buildAchadinho({ status: "REJECTED" }),
    );

    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      action: "reject",
    });
    const res = await PATCH(req as any, params);

    expect(res.status).toBe(200);
    const updateArgs = (prismaMock.shopeeAchadinhoProduct.update as any).mock
      .calls[0][0];
    expect(updateArgs.data.status).toBe("REJECTED");
  });

  it("reset devolve para a fila de revisão", async () => {
    mockAuthenticatedAdmin();
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(
      buildAchadinho({ status: "REJECTED" }),
    );
    (prismaMock.shopeeAchadinhoProduct.update as any).mockResolvedValue(
      buildAchadinho({ status: "PENDING" }),
    );

    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      action: "reset",
    });
    await PATCH(req as any, params);

    const updateArgs = (prismaMock.shopeeAchadinhoProduct.update as any).mock
      .calls[0][0];
    expect(updateArgs.data.status).toBe("PENDING");
  });

  it("recusa revisar registro PROCESSING (pertence ao pipeline)", async () => {
    mockAuthenticatedAdmin();
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(
      buildAchadinho({ status: "PROCESSING" }),
    );

    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      action: "approve",
    });
    const res = await PATCH(req as any, params);

    expect(res.status).toBe(409);
    expect(prismaMock.shopeeAchadinhoProduct.update).not.toHaveBeenCalled();
  });

  it("recusa revisar registro FAILED", async () => {
    mockAuthenticatedAdmin();
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(
      buildAchadinho({ status: "FAILED" }),
    );

    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      action: "approve",
    });
    const res = await PATCH(req as any, params);

    expect(res.status).toBe(409);
  });

  it("recusa ação desconhecida", async () => {
    mockAuthenticatedAdmin();

    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      action: "publish",
    });
    const res = await PATCH(req as any, params);

    expect(res.status).toBe(400);
  });

  it("recusa corpo vazio (sem link nem ação)", async () => {
    mockAuthenticatedAdmin();

    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {});
    const res = await PATCH(req as any, params);

    expect(res.status).toBe(400);
  });

  it("retorna 404 quando o achadinho não existe", async () => {
    mockAuthenticatedAdmin();
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(null);

    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      action: "approve",
    });
    const res = await PATCH(req as any, params);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/shopee/achadinhos/[id] — link de afiliado", () => {
  const params = { params: { id: "ach-1" } };

  beforeEach(() => vi.clearAllMocks());

  it("recusa URL inválida", async () => {
    mockAuthenticatedAdmin();

    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      affiliateLink: "javascript:alert(1)",
    });
    const res = await PATCH(req as any, params);

    expect(res.status).toBe(400);
    expect(prismaMock.shopeeAchadinhoProduct.update).not.toHaveBeenCalled();
  });

  it("preserva o link gerado pela automação em originalAffLink", async () => {
    mockAuthenticatedAdmin();
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(
      buildAchadinho({
        originalAffLink: null,
        affiliateLink: "https://shope.ee/gerado",
      }),
    );
    (prismaMock.shopeeAchadinhoProduct.update as any).mockResolvedValue(
      buildAchadinho(),
    );

    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      affiliateLink: "https://shope.ee/manual",
    });
    await PATCH(req as any, params);

    const updateArgs = (prismaMock.shopeeAchadinhoProduct.update as any).mock
      .calls[0][0];
    expect(updateArgs.data.affiliateLink).toBe("https://shope.ee/manual");
    expect(updateArgs.data.originalAffLink).toBe("https://shope.ee/gerado");
  });

  it("permite editar link e aprovar na mesma requisição", async () => {
    mockAuthenticatedAdmin();
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(
      buildAchadinho({ status: "PENDING" }),
    );
    (prismaMock.shopeeAchadinhoProduct.update as any).mockResolvedValue(
      buildAchadinho({ status: "READY" }),
    );

    const req = makePatchRequest("/api/shopee/achadinhos/ach-1", {
      affiliateLink: "https://shope.ee/corrigido",
      action: "approve",
    });
    const res = await PATCH(req as any, params);

    expect(res.status).toBe(200);
    const updateArgs = (prismaMock.shopeeAchadinhoProduct.update as any).mock
      .calls[0][0];
    expect(updateArgs.data.affiliateLink).toBe("https://shope.ee/corrigido");
    expect(updateArgs.data.status).toBe("READY");
  });
});
