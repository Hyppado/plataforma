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

const getSetting = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/settings", () => ({
  getSecretSetting: vi.fn().mockResolvedValue("sk-test"),
  getSetting: (...a: unknown[]) => getSetting(...a),
  SETTING_KEYS: {
    OPENAI_API_KEY: "openai.api_key",
    SHOPEE_ACHADINHOS_MIN_VIEWS: "shopee.achadinhos_min_views",
  },
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
    getAchadinhosHashtagIds: vi.fn().mockResolvedValue(["1696392324325382"]),
  };
});

import { processAchadinhosBatch, prioridadePorViews } from "@/lib/shopee/pipeline";
import { ACHADINHOS_MAX_HASHTAGS } from "@/lib/shopee/types";

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
  // O pipeline traduz productCatIds pela dimensão de categorias. O mock
  // compartilhado devolve null por padrão, forma que o findMany real nunca
  // produz — sem isto, todo item falharia na classificação.
  (prismaMock.shopeeCategory.findMany as any).mockResolvedValue([]);
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

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

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

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

    expect(result.alreadyProcessed).toBe(2);
    expect(result.processed).toBe(0);
  });

  it("reprocessa PROCESSING — sobra de execução morta no meio", async () => {
    mockHashtagPage(1);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue([
      { videoExternalId: "video-0", status: "PROCESSING", updatedAt: new Date() },
    ]);

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

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

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

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

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

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

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

    expect(result.processed).toBe(1);
  });

  it("falha TRANSITÓRIA ainda dentro de 1h continua fora da fila", async () => {
    mockHashtagPage(1);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue(
      failedRow(30, true),
    );

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

    expect(result.processed).toBe(0);
    expect(result.alreadyProcessed).toBe(1);
  });

  it("falha DEFINITIVA continua fora por 24h, mesmo após 1h", async () => {
    // Vídeo sem fala não melhora em uma hora — não vale re-gastar Whisper.
    mockHashtagPage(1);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue(
      failedRow(90, false),
    );

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

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
    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20, budgetMs: 1_000 });

    expect(result.processed).toBe(0);
    expect(result.partial).toBe(true);
    expect(result.remaining).toBe(5);
    expect(prismaMock.shopeeAchadinhoProduct.upsert).not.toHaveBeenCalled();
  });

  it("marca partial=false quando processa o lote inteiro", async () => {
    mockHashtagPage(3);

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

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
    const result = await processAchadinhosBatch({ pageDelayMs: 0,
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

    await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

    // upsert (PROCESSING) chamado por vídeo, antes de qualquer fase final
    expect(prismaMock.shopeeAchadinhoProduct.upsert).toHaveBeenCalledTimes(3);
    // e a transcrição é gravada imediatamente após ser obtida
    expect(prismaMock.shopeeAchadinhoProduct.update).toHaveBeenCalled();
  });

  it("devolve resultado vazio quando a hashtag não retorna vídeos", async () => {
    fetchVideosByHashtag.mockResolvedValue({ data: { aweme_list: [], has_more: 0 } });

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

    expect(result.found).toBe(0);
    expect(result.processed).toBe(0);
    expect(result.partial).toBe(false);
  });

  it("descarta vídeos abaixo do limiar de relevância (30k views)", async () => {
    mockHashtagPage(3, 1_000);

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

    expect(result.found).toBe(0);
    expect(result.processed).toBe(0);
  });
});

describe("processAchadinhosBatch — piso de views configurável e idade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenAiSuccess();
    mockDbWrites();
    getVideoCaptions.mockResolvedValue({ text: "legenda" });
    findBestShopeeOffer.mockResolvedValue(null);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue([]);
  });

  /** ID de vídeo TikTok com a data de publicação embutida nos 32 bits altos. */
  function tiktokIdFor(date: Date): string {
    return (BigInt(Math.floor(date.getTime() / 1000)) * BigInt(4294967296)).toString();
  }

  function mockPageWithIds(ids: string[], views = 5_000) {
    fetchVideosByHashtag.mockResolvedValue({
      data: {
        aweme_list: ids.map((id) => ({
          aweme_id: id,
          desc: "achadinho",
          author: { unique_id: "creator" },
          video: { cover: { url_list: ["https://cdn/c.jpg"] } },
          statistics: { play_count: views },
        })),
        has_more: 0,
      },
    });
  }

  it("admite vídeos abaixo de 30k quando o admin baixa o piso", async () => {
    // Era o gargalo real: com 30k fixo, ~90% da hashtag era descartada e a
    // fila esgotava.
    getSetting.mockResolvedValue("1000");
    mockPageWithIds([tiktokIdFor(new Date())], 5_000);

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

    expect(result.found).toBe(1);
  });

  it("mantém o padrão de 30k quando não há setting", async () => {
    getSetting.mockResolvedValue(null);
    mockPageWithIds([tiktokIdFor(new Date())], 5_000);

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

    expect(result.found).toBe(0);
  });

  it("descarta vídeo antigo demais — EchoTik não serve download-url", async () => {
    getSetting.mockResolvedValue("1000");
    const doisAnosAtras = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    mockPageWithIds([tiktokIdFor(doisAnosAtras)], 500_000);

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

    expect(result.found).toBe(0);
  });

  it("aceita vídeo recente com muitas views", async () => {
    getSetting.mockResolvedValue("1000");
    mockPageWithIds([tiktokIdFor(new Date())], 500_000);

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

    expect(result.found).toBe(1);
  });
});


describe("processAchadinhosBatch — alvo de inventário e múltiplas hashtags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenAiSuccess();
    mockDbWrites();
    getVideoCaptions.mockResolvedValue({ text: "legenda" });
    findBestShopeeOffer.mockResolvedValue(null);
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue([]);
  });

  it("não processa nada quando o inventário já está no alvo", async () => {
    mockHashtagPage(5);
    (prismaMock.shopeeAchadinhoProduct.count as any).mockResolvedValue(50);

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20, targetInventory: 50 });

    expect(result.processed).toBe(0);
    expect(result.targetReached).toBe(true);
  });

  it("para no meio do lote ao alcançar o alvo", async () => {
    // Inventário 49, alvo 50: um sucesso já fecha a conta.
    mockHashtagPage(5);
    (prismaMock.shopeeAchadinhoProduct.count as any).mockResolvedValue(49);
    findBestShopeeOffer.mockResolvedValue({
      offerLink: "https://shopee.com.br/product/1",
      productLink: "https://shopee.com.br/product/1",
      priceMin: "10", priceMax: "20", sales: 5, commissionRate: "5",
      imageUrl: "https://cdn/i.jpg", productName: "P", productCatIds: [100632],
    });

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20, targetInventory: 50 });

    expect(result.processed).toBe(1);
    expect(result.targetReached).toBe(true);
  });

  it("sem alvo definido, processa tudo que encontrar", async () => {
    mockHashtagPage(3);
    (prismaMock.shopeeAchadinhoProduct.count as any).mockResolvedValue(999);

    const result = await processAchadinhosBatch({ pageDelayMs: 0, count: 20 });

    expect(result.processed).toBe(3);
  });

  it("consulta várias hashtags e deduplica entre elas", async () => {
    // A mesma página volta para as duas hashtags: o vídeo não pode contar 2x.
    mockHashtagPage(4);
    (prismaMock.shopeeAchadinhoProduct.count as any).mockResolvedValue(0);

    const result = await processAchadinhosBatch({ pageDelayMs: 0,
      count: 40,
      hashtagIds: ["1696392324325382", "1697332031215622"],
    });

    expect(fetchVideosByHashtag).toHaveBeenCalled();
    // 4 vídeos únicos, mesmo tendo vindo de duas hashtags
    expect(result.found).toBe(4);
  });

  it("corta hashtags acima do teto em vez de varrer todas", async () => {
    // Config gravada antes da validação da API admin (ou via env) pode trazer
    // mais que o teto. Varrer todas estoura o orçamento de descoberta e as
    // últimas não seriam lidas de qualquer forma.
    mockHashtagPage(1);
    (prismaMock.shopeeAchadinhoProduct.count as any).mockResolvedValue(0);

    const excedente = Array.from({ length: ACHADINHOS_MAX_HASHTAGS + 3 }, (_, i) =>
      String(1000000000000000 + i),
    );

    await processAchadinhosBatch({ pageDelayMs: 0, count: 20, hashtagIds: excedente });

    const varridas = new Set(
      (fetchVideosByHashtag as any).mock.calls.map((c: any[]) => c[0].hashtagId),
    );
    expect(varridas.size).toBe(ACHADINHOS_MAX_HASHTAGS);
    // As excedentes ficam de fora, na ordem em que foram configuradas
    for (const id of excedente.slice(ACHADINHOS_MAX_HASHTAGS)) {
      expect(varridas.has(id)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Descoberta em round-robin e ordenação por views
// ---------------------------------------------------------------------------
describe("processAchadinhosBatch — descoberta entre hashtags", () => {
  beforeEach(() => {
    // Nada processado antes: todo vídeo descoberto é candidato.
    (prismaMock.shopeeAchadinhoProduct.findMany as any).mockResolvedValue([]);
    (prismaMock.shopeeAchadinhoProduct.count as any).mockResolvedValue(0);
  });

  /** Cada hashtag devolve vídeos próprios, identificáveis pelo id. */
  function mockPorHashtag(views: Record<string, number>) {
    fetchVideosByHashtag.mockImplementation(async ({ hashtagId }: any) => ({
      data: {
        aweme_list: [awemeItem(`v-${hashtagId}`, views[hashtagId] ?? 100_000)],
        has_more: 0,
      },
    }));
  }

  it("visita TODAS as hashtags configuradas, não só as primeiras", async () => {
    // ESTE é o bug relatado: a descoberta paginava hashtag por hashtag até
    // completar uma cota, gastava o orçamento nas primeiras e nunca chegava
    // nas últimas. Com 8 configuradas, só ~3 contribuíam — e sempre as mesmas,
    // sempre desde a página 0, daí a repetição de vídeos já processados.
    const ids = ["h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8"];
    mockPorHashtag({});

    await processAchadinhosBatch({ pageDelayMs: 0, count: 400, hashtagIds: ids });

    const visitadas = new Set(
      (fetchVideosByHashtag as any).mock.calls.map((c: any[]) => c[0].hashtagId),
    );
    expect(Array.from(visitadas).sort()).toEqual(ids);
  });

  it("dá a primeira página de cada hashtag antes de aprofundar qualquer uma", async () => {
    // Round-robin: a ordem das chamadas precisa alternar entre hashtags, não
    // esgotar uma para só então passar à seguinte.
    const ids = ["h1", "h2", "h3"];
    fetchVideosByHashtag.mockImplementation(async ({ hashtagId, offset }: any) => ({
      data: {
        aweme_list: [awemeItem(`v-${hashtagId}-${offset}`)],
        has_more: 1, // sempre há mais, para forçar uma 2ª rodada
      },
    }));

    await processAchadinhosBatch({ pageDelayMs: 0, count: 400, hashtagIds: ids });

    const ordem = (fetchVideosByHashtag as any).mock.calls
      .slice(0, 3)
      .map((c: any[]) => c[0].hashtagId);
    expect(ordem).toEqual(ids);
    // e a 4ª chamada volta para a primeira hashtag, já com offset avançado
    const quarta = (fetchVideosByHashtag as any).mock.calls[3]?.[0];
    expect(quarta?.hashtagId).toBe("h1");
    expect(quarta?.offset).toBeGreaterThan(0);
  });

  it("processa os mais promissores primeiro, não os mais vistos", async () => {
    // O aproveitamento por faixa NÃO é monotônico: mede 71% entre 200k e 500k
    // e cai para 30% acima de 3M. Ordenar por views decrescente colocava a
    // pior faixa na frente — numa execução real os 12 vídeos acima de 1M
    // falharam todos, enquanto os acertos vieram da faixa de 193k a 973k.
    mockPorHashtag({ viral: 8_000_000, boa: 300_000, fraca: 5_000 });
    findBestShopeeOffer.mockResolvedValue({
      offerLink: "https://shopee.com.br/product/1",
      productLink: "https://shopee.com.br/product/1",
      priceMin: "10", priceMax: "20", sales: 5, commissionRate: "5",
      imageUrl: "https://cdn/i.jpg", productName: "P", productCatIds: [100632],
    });

    await processAchadinhosBatch({
      pageDelayMs: 0,
      count: 400,
      hashtagIds: ["viral", "boa", "fraca"],
    });

    // A ordem de criação no banco reflete a ordem de processamento
    const criados = (prismaMock.shopeeAchadinhoProduct.upsert as any).mock.calls
      .map((c: any[]) => c[0].where?.videoExternalId)
      .filter(Boolean);
    // 300k (faixa de 71%) na frente; o viral de 8M fica por último (30%)
    expect(criados[0]).toBe("v-boa");
    expect(criados[criados.length - 1]).toBe("v-viral");
  });
});

describe("prioridadePorViews()", () => {
  it("prioriza a faixa de melhor aproveitamento (200k–500k)", () => {
    const faixas = [5_000, 100_000, 300_000, 700_000, 2_000_000, 8_000_000];
    const melhor = faixas.reduce((a, b) =>
      prioridadePorViews(b) > prioridadePorViews(a) ? b : a,
    );
    expect(melhor).toBe(300_000);
  });

  it("NÃO é monotônico — o viral extremo perde para a faixa média", () => {
    // A intuição "mais views, melhor" está errada na cauda: medido, acima de
    // 3M o aproveitamento cai (30%) ao patamar da pior faixa.
    expect(prioridadePorViews(8_000_000)).toBeLessThan(prioridadePorViews(300_000));
    expect(prioridadePorViews(8_000_000)).toBeLessThan(prioridadePorViews(100_000));
  });

  it("dentro da faixa boa, mais views continua sendo melhor que menos", () => {
    expect(prioridadePorViews(300_000)).toBeGreaterThan(prioridadePorViews(100_000));
    expect(prioridadePorViews(100_000)).toBeGreaterThan(prioridadePorViews(10_000));
  });
});
