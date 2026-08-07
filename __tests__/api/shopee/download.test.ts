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

import { GET } from "@/app/api/shopee/achadinhos/[id]/download/route";

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
