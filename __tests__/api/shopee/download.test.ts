/**
 * Tests: app/api/shopee/achadinhos/[id]/download/route.ts
 *
 * Baixar o vídeo é a ação de maior valor para o assinante (repostar no
 * próprio canal), e envolve credenciais + conteúdo não publicado. Cobre a
 * guarda de visibilidade e a degradação quando a EchoTik não resolve a URL.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";
import {
  mockAuthenticatedUser,
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  makeGetRequest,
} from "@tests/helpers/auth";

vi.mock("@/lib/prisma");

const getVideoDownloadUrl = vi.fn();
vi.mock("@/lib/transcription/media", () => ({
  getVideoDownloadUrl: (...a: unknown[]) => getVideoDownloadUrl(...a),
}));

const assertQuota = vi.fn();
const consumeUsage = vi.fn();
vi.mock("@/lib/usage/enforce", async () => {
  const real = await vi.importActual<typeof import("@/lib/usage/enforce")>(
    "@/lib/usage/enforce",
  );
  return { ...real, assertQuota: (...a: unknown[]) => assertQuota(...a) };
});
vi.mock("@/lib/usage/consume", () => ({
  consumeUsage: (...a: unknown[]) => consumeUsage(...a),
}));

import { GET } from "@/app/api/shopee/achadinhos/[id]/download/route";
import { QuotaExceededError } from "@/lib/usage/enforce";

const params = { params: { id: "ach-1" } };

function achadinho(overrides: Record<string, unknown> = {}) {
  return {
    videoExternalId: "7300000000000000000",
    productName: "Fone de Ouvido Bluetooth",
    authorName: "creator",
    status: "READY",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertQuota.mockResolvedValue(undefined);
  consumeUsage.mockResolvedValue({ duplicate: false });
  (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(achadinho());
  getVideoDownloadUrl.mockResolvedValue({
    noWatermarkUrl: "https://cdn/nowm.mp4",
    downloadUrl: "https://cdn/dl.mp4",
    playUrl: "https://cdn/play.mp4",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream(),
      headers: new Headers({ "content-type": "video/mp4", "content-length": "1024" }),
    }),
  );
});

describe("guardas", () => {
  it("rejeita não autenticado", async () => {
    mockUnauthenticated();
    const res = await GET(makeGetRequest("/download") as any, params);
    expect(res.status).toBe(401);
  });

  it("404 quando o achadinho não existe", async () => {
    mockAuthenticatedUser();
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(null);

    const res = await GET(makeGetRequest("/download") as any, params);
    expect(res.status).toBe(404);
  });

  it("usuário comum não baixa achadinho não publicado", async () => {
    mockAuthenticatedUser();
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(
      achadinho({ status: "PENDING" }),
    );

    const res = await GET(makeGetRequest("/download") as any, params);
    expect(res.status).toBe(403);
  });

  it("admin baixa mesmo em revisão — precisa avaliar antes de aprovar", async () => {
    mockAuthenticatedAdmin();
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(
      achadinho({ status: "PENDING" }),
    );

    const res = await GET(makeGetRequest("/download") as any, params);
    expect(res.status).toBe(200);
  });
});

describe("download", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("prefere a versão sem marca d'água", async () => {
    await GET(makeGetRequest("/download") as any, params);

    expect((globalThis.fetch as any).mock.calls[0][0]).toBe("https://cdn/nowm.mp4");
  });

  it("cai para downloadUrl quando não há versão sem marca", async () => {
    getVideoDownloadUrl.mockResolvedValue({
      noWatermarkUrl: null,
      downloadUrl: "https://cdn/dl.mp4",
      playUrl: null,
    });

    await GET(makeGetRequest("/download") as any, params);

    expect((globalThis.fetch as any).mock.calls[0][0]).toBe("https://cdn/dl.mp4");
  });

  it("devolve anexo com nome derivado do produto", async () => {
    const res = await GET(makeGetRequest("/download") as any, params);

    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="fone-de-ouvido-bluetooth.mp4"',
    );
    expect(res.headers.get("content-type")).toBe("video/mp4");
  });

  it("usa o id do vídeo quando não há nome de produto", async () => {
    (prismaMock.shopeeAchadinhoProduct.findUnique as any).mockResolvedValue(
      achadinho({ productName: null }),
    );

    const res = await GET(makeGetRequest("/download") as any, params);

    expect(res.headers.get("content-disposition")).toContain(
      "achadinho-7300000000000000000.mp4",
    );
  });

  it("503 quando a EchoTik não resolve a URL", async () => {
    getVideoDownloadUrl.mockResolvedValue(null);

    const res = await GET(makeGetRequest("/download") as any, params);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toMatch(/indisponível/i);
  });

  it("502 quando o CDN falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, body: null, headers: new Headers() }),
    );

    const res = await GET(makeGetRequest("/download") as any, params);
    expect(res.status).toBe(502);
  });

  it("502 quando a rede cai", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    const res = await GET(makeGetRequest("/download") as any, params);
    expect(res.status).toBe(502);
  });
});


// ---------------------------------------------------------------------------
// Cota mensal de downloads
// ---------------------------------------------------------------------------

describe("cota de downloads da Shopee", () => {
  it("recusa com 429 quando o limite do mês foi atingido", async () => {
    mockAuthenticatedUser();
    assertQuota.mockRejectedValue(
      new QuotaExceededError("SHOPEE_VIDEO_DOWNLOAD", 10, 10),
    );

    const res = await GET(makeGetRequest("/download") as any, params);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("10");
    expect(body.quota).toEqual({ used: 10, limit: 10 });
  });

  /**
   * A checagem vem antes de resolver a URL: cada resolução gasta uma
   * requisição da cota da EchoTik, e gastá-la num download que será recusado
   * é desperdício puro.
   */
  it("não chama a EchoTik quando a cota está esgotada", async () => {
    mockAuthenticatedUser();
    assertQuota.mockRejectedValue(
      new QuotaExceededError("SHOPEE_VIDEO_DOWNLOAD", 10, 10),
    );

    await GET(makeGetRequest("/download") as any, params);

    expect(getVideoDownloadUrl).not.toHaveBeenCalled();
  });

  it("registra o consumo quando o download é entregue", async () => {
    mockAuthenticatedUser();

    const res = await GET(makeGetRequest("/download") as any, params);

    expect(res.status).toBe(200);
    expect(consumeUsage).toHaveBeenCalledWith(
      expect.any(String),
      "SHOPEE_VIDEO_DOWNLOAD",
      0,
      expect.objectContaining({ refTable: "ShopeeAchadinhoProduct" }),
    );
  });

  /**
   * O limite é diário, então a idempotência precisa ser por dia. Com chave
   * mensal, rebaixar hoje um vídeo já baixado ontem não geraria evento — e o
   * teto do dia nunca seria alcançado por quem repete downloads.
   */
  it("usa chave de idempotência do dia, não do mês", async () => {
    mockAuthenticatedUser();

    await GET(makeGetRequest("/download") as any, params);

    const chave = (consumeUsage.mock.calls[0] as any[])[3].idempotencyKey;
    const hoje = new Date().toISOString().slice(0, 10);
    expect(chave).toContain(hoje);
    // AAAA-MM-DD, não AAAA-MM
    expect(chave).toMatch(/\d{4}-\d{2}-\d{2}$/);
  });

  it("a mensagem de recusa fala em hoje, não no mês", async () => {
    mockAuthenticatedUser();
    assertQuota.mockRejectedValue(
      new QuotaExceededError("SHOPEE_VIDEO_DOWNLOAD", 10, 10),
    );

    const res = await GET(makeGetRequest("/download") as any, params);
    const body = await res.json();

    expect(body.error).toMatch(/hoje/i);
    expect(body.error).not.toMatch(/m[êe]s/i);
  });

  /**
   * Se a EchoTik não resolve a URL, o usuário não recebe vídeo — então não
   * pode perder um download da cota.
   */
  it("não consome cota quando a EchoTik não resolve a URL", async () => {
    mockAuthenticatedUser();
    getVideoDownloadUrl.mockResolvedValue(null);

    const res = await GET(makeGetRequest("/download") as any, params);

    expect(res.status).toBe(503);
    expect(consumeUsage).not.toHaveBeenCalled();
  });

  it("não consome cota quando o CDN falha", async () => {
    mockAuthenticatedUser();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, body: null, headers: new Headers() }),
    );

    const res = await GET(makeGetRequest("/download") as any, params);

    expect(res.status).toBe(502);
    expect(consumeUsage).not.toHaveBeenCalled();
  });

  /** Falha de contabilidade não pode negar um download já autorizado. */
  it("entrega o vídeo mesmo se registrar o consumo falhar", async () => {
    mockAuthenticatedUser();
    consumeUsage.mockRejectedValue(new Error("banco fora do ar"));

    const res = await GET(makeGetRequest("/download") as any, params);

    expect(res.status).toBe(200);
  });
});
