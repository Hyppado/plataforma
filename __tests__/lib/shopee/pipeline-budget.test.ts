/**
 * Tests: lib/shopee/pipeline.ts — orçamento de tempo e retomada
 *
 * Garante que o lote de achadinhos nunca estoure o maxDuration da Vercel e
 * que execuções consecutivas sejam CUMULATIVAS (pulam o que já foi feito) em
 * vez de repetitivas.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";

vi.mock("@/lib/prisma");

// Descoberta de vídeos na hashtag
const fetchVideosByHashtag = vi.fn();
vi.mock("@/lib/echotik/client", () => ({
  fetchVideosByHashtag: (...args: unknown[]) => fetchVideosByHashtag(...args),
}));

// Transcrição — controlada por teste para simular custo de tempo
const getVideoCaptions = vi.fn();
vi.mock("@/lib/transcription/media", () => ({
  getVideoCaptions: (...args: unknown[]) => getVideoCaptions(...args),
  getVideoDownloadUrl: vi.fn().mockResolvedValue(null),
  downloadVideoBuffer: vi.fn().mockResolvedValue(null),
  parseCaptionToPlainText: (raw: string) => raw,
}));

vi.mock("@/lib/transcription/whisper", () => ({
  transcribeWithWhisper: vi.fn().mockResolvedValue({ text: "" }),
  isWhisperError: () => false,
}));

vi.mock("@/lib/settings", () => ({
  getSecretSetting: vi.fn().mockResolvedValue("sk-test"),
  getSetting: vi.fn().mockResolvedValue(null),
  SETTING_KEYS: { OPENAI_API_KEY: "openai.api_key" },
}));

const findBestShopeeOffer = vi.fn();
vi.mock("@/lib/shopee/shopee-api-client", () => ({
  findBestShopeeOffer: (...args: unknown[]) => findBestShopeeOffer(...args),
  generateShortLink: vi.fn().mockResolvedValue("https://shope.ee/short"),
}));

vi.mock("@/lib/shopee/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shopee/client")>(
    "@/lib/shopee/client",
  );
  return {
    ...actual,
    getAchadinhosHashtagId: vi.fn().mockResolvedValue("1696392324325382"),
  };
});

import { processAchadinhosBatch } from "@/lib/shopee/pipeline";

/** Item cru da EchoTik, acima do limiar de 30k views. */
function awemeItem(id: string, views = 100_000) {
  return {
    aweme_id: id,
    desc: `achadinho ${id}`,
    author: { unique_id: "creator" },
    video: { cover: { url_list: ["https://cdn/cover.jpg"] } },
    statistics: { play_count: views },
  };
}

/** Faz a hashtag devolver uma única página com N vídeos. */
function mockHashtagPage(count: number, views = 100_000) {
  const items = Array.from({ length: count }, (_, i) =>
    awemeItem(`video-${i}`, views),
  );
  fetchVideosByHashtag.mockResolvedValue({
    data: { aweme_list: items, has_more: 0 },
  });
  return items;
}

/** OpenAI devolve sempre um nome de produto válido. */
function mockOpenAiSuccess() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "fone de ouvido bluetooth" } }],
      }),
    }),
  );
}

function mockDbWrites() {
  (prismaMock.shopeeAchadinhoProduct.upsert as any).mockImplementation(
    async ({ where }: any) => ({ id: `rec-${where.videoExternalId}` }),
  );
  (prismaMock.shopeeAchadinhoProduct.update as any).mockResolvedValue({});
}

describe("processAchadinhosBatch — retomada entre execuções", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenAiSuccess();
    mockDbWrites();
    getVideoCaptions.mockResolvedValue({ text: "legenda do vídeo" });
    findBestShopeeOffer.mockResolvedValue({
      offerLink: "https://shopee.com.br/product/1",
      priceMin: "49.90",
      priceMax: "59.90",
      sales: 100,
      commissionRate: "8.5",
      imageUrl: "https://cdn/img.jpg",
      productName: "Fone",
      productCatIds: [100632],
    });
  });

  it("pula vídeos já processados — execuções são cumulativas", async () => {
    mockHashtagPage(3);
    // Dois já passaram pelo pipeline (PENDING é terminal de sucesso)
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue([
      { videoExternalId: "video-0", status: "PENDING", updatedAt: new Date() },
      { videoExternalId: "video-1", status: "READY", updatedAt: new Date() },
    ]);

    const result = await processAchadinhosBatch({ count: 20 });

    expect(result.found).toBe(3);
    expect(result.alreadyProcessed).toBe(2);
    expect(result.processed).toBe(1);
    expect(result.partial).toBe(false);
  });

  it("não reprocessa REJECTED — decisão do admin é respeitada", async () => {
    mockHashtagPage(2);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue([
      { videoExternalId: "video-0", status: "REJECTED", updatedAt: new Date() },
      { videoExternalId: "video-1", status: "REJECTED", updatedAt: new Date() },
    ]);

    const result = await processAchadinhosBatch({ count: 20 });

    expect(result.alreadyProcessed).toBe(2);
    expect(result.processed).toBe(0);
  });

  it("reprocessa PROCESSING — sobra de execução morta no meio", async () => {
    mockHashtagPage(1);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue([
      { videoExternalId: "video-0", status: "PROCESSING", updatedAt: new Date() },
    ]);

    const result = await processAchadinhosBatch({ count: 20 });

    expect(result.processed).toBe(1);
  });

  it("respeita o cooldown de FAILED — não tenta de novo no mesmo dia", async () => {
    mockHashtagPage(1);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue([
      {
        videoExternalId: "video-0",
        status: "FAILED",
        updatedAt: new Date(),
        errorMessage: "Nenhum produto identificado",
      },
    ]);

    const result = await processAchadinhosBatch({ count: 20 });

    expect(result.alreadyProcessed).toBe(1);
    expect(result.processed).toBe(0);
  });

  it("tenta FAILED de novo depois do cooldown", async () => {
    mockHashtagPage(1);
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue([
      {
        videoExternalId: "video-0",
        status: "FAILED",
        updatedAt: old,
        errorMessage: "Nenhum produto identificado",
      },
    ]);

    const result = await processAchadinhosBatch({ count: 20 });

    expect(result.processed).toBe(1);
  });
});

describe("processAchadinhosBatch — cooldown transitório vs definitivo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenAiSuccess();
    mockDbWrites();
    getVideoCaptions.mockResolvedValue({ text: "legenda" });
    findBestShopeeOffer.mockResolvedValue(null);
  });

  /** Falha do fornecedor, gravada com o prefixo transitório. */
  function failedRow(minutesAgo: number, transient: boolean) {
    return [
      {
        videoExternalId: "video-0",
        status: "FAILED",
        updatedAt: new Date(Date.now() - minutesAgo * 60 * 1000),
        errorMessage: transient
          ? "[transitório] URL de download indisponível na EchoTik"
          : "Vídeo sem fala transcrevível",
      },
    ];
  }

  it("falha TRANSITÓRIA volta à fila depois de 1h", async () => {
    // Cenário real: rate limit da EchoTik marcou 12 vídeos bons como FAILED.
    // Eles não podem ficar 24h fora por causa de um soluço do fornecedor.
    mockHashtagPage(1);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue(
      failedRow(90, true),
    );

    const result = await processAchadinhosBatch({ count: 20 });

    expect(result.processed).toBe(1);
  });

  it("falha TRANSITÓRIA ainda dentro de 1h continua fora da fila", async () => {
    mockHashtagPage(1);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue(
      failedRow(30, true),
    );

    const result = await processAchadinhosBatch({ count: 20 });

    expect(result.processed).toBe(0);
    expect(result.alreadyProcessed).toBe(1);
  });

  it("falha DEFINITIVA continua fora por 24h, mesmo após 1h", async () => {
    // Vídeo sem fala não melhora em uma hora — não vale re-gastar Whisper.
    mockHashtagPage(1);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue(
      failedRow(90, false),
    );

    const result = await processAchadinhosBatch({ count: 20 });

    expect(result.processed).toBe(0);
    expect(result.alreadyProcessed).toBe(1);
  });
});

describe("processAchadinhosBatch — orçamento de tempo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenAiSuccess();
    mockDbWrites();
    getVideoCaptions.mockResolvedValue({ text: "legenda" });
    findBestShopeeOffer.mockResolvedValue(null);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue([]);
  });

  it("não inicia nenhum vídeo quando não cabe o pior caso", async () => {
    mockHashtagPage(5);

    // Orçamento menor que VIDEO_WORST_CASE_MS (90s) — nada deve começar
    const result = await processAchadinhosBatch({ count: 20, budgetMs: 1_000 });

    expect(result.processed).toBe(0);
    expect(result.partial).toBe(true);
    expect(result.remaining).toBe(5);
    expect(prismaMock.shopeeAchadinhoProduct.upsert).not.toHaveBeenCalled();
  });

  it("marca partial=false quando processa o lote inteiro", async () => {
    mockHashtagPage(3);

    const result = await processAchadinhosBatch({ count: 20 });

    expect(result.processed).toBe(3);
    expect(result.remaining).toBe(0);
    expect(result.partial).toBe(false);
  });

  it("para no meio do lote quando o orçamento acaba", async () => {
    mockHashtagPage(4);

    // Cada vídeo "gasta" 40s de relógio simulado na transcrição.
    let now = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    getVideoCaptions.mockImplementation(async () => {
      now += 40_000;
      return { text: "legenda" };
    });

    // 200s de orçamento: cabe apenas enquanto restar >= 90s
    const result = await processAchadinhosBatch({
      count: 20,
      budgetMs: 200_000,
    });

    nowSpy.mockRestore();

    expect(result.partial).toBe(true);
    expect(result.processed).toBeGreaterThan(0);
    expect(result.processed).toBeLessThan(4);
    expect(result.remaining).toBe(4 - result.processed);
  });

  it("persiste cada vídeo durante o lote — trabalho pago nunca é perdido", async () => {
    mockHashtagPage(3);

    await processAchadinhosBatch({ count: 20 });

    // upsert (PROCESSING) chamado por vídeo, antes de qualquer fase final
    expect(prismaMock.shopeeAchadinhoProduct.upsert).toHaveBeenCalledTimes(3);
    // e a transcrição é gravada imediatamente após ser obtida
    expect(prismaMock.shopeeAchadinhoProduct.update).toHaveBeenCalled();
  });

  it("devolve resultado vazio quando a hashtag não retorna vídeos", async () => {
    fetchVideosByHashtag.mockResolvedValue({ data: { aweme_list: [], has_more: 0 } });

    const result = await processAchadinhosBatch({ count: 20 });

    expect(result.found).toBe(0);
    expect(result.processed).toBe(0);
    expect(result.partial).toBe(false);
  });

  it("descarta vídeos abaixo do limiar de relevância (30k views)", async () => {
    mockHashtagPage(3, 1_000);

    const result = await processAchadinhosBatch({ count: 20 });

    expect(result.found).toBe(0);
    expect(result.processed).toBe(0);
  });
});
