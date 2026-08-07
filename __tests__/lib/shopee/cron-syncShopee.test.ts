/**
 * Tests: lib/shopee/cron/syncShopee.ts
 *
 * Regra central e não óbvia: o cron roda a cada 6h, mas a cadência EFETIVA
 * vem de uma Setting (24h ranking / 12h achadinhos). Um lote PARCIAL não pode
 * iniciar o cooldown — senão o backlog congela e nunca é drenado.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";

vi.mock("@/lib/prisma");

const getSetting = vi.fn();
vi.mock("@/lib/settings", () => ({
  getSetting: (...args: unknown[]) => getSetting(...args),
  SETTING_KEYS: {
    SHOPEE_RANKING_FREQUENCY: "shopee.ranking_frequency",
    SHOPEE_ACHADINHOS_FREQUENCY: "shopee.achadinhos_frequency",
    SHOPEE_ACHADINHOS_COUNT: "shopee.achadinhos_count",
  },
}));

const syncShopeeRankings = vi.fn();
vi.mock("@/lib/shopee/client", () => ({
  syncShopeeRankings: () => syncShopeeRankings(),
}));

const processAchadinhosBatch = vi.fn();
vi.mock("@/lib/shopee/pipeline", () => ({
  processAchadinhosBatch: (...args: unknown[]) => processAchadinhosBatch(...args),
}));

import {
  runShopeeRankingsCron,
  runShopeeAchadinhosCron,
} from "@/lib/shopee/cron/syncShopee";

/** Nenhuma execução anterior — o gate deixa passar. */
function noPreviousRun() {
  (prismaMock.ingestionRun.findFirst as any).mockResolvedValue(null);
}

/** Última execução bem-sucedida e COMPLETA dentro da janela. */
function recentCompleteRun() {
  (prismaMock.ingestionRun.findFirst as any).mockResolvedValue({
    id: "run-old",
    startedAt: new Date(),
    statsJson: { partial: false },
  });
}

/** Última execução bem-sucedida porém PARCIAL. */
function recentPartialRun() {
  (prismaMock.ingestionRun.findFirst as any).mockResolvedValue({
    id: "run-old",
    startedAt: new Date(),
    statsJson: { partial: true },
  });
}

function batchResult(overrides: Record<string, unknown> = {}) {
  return {
    found: 10,
    alreadyProcessed: 0,
    processed: 10,
    succeeded: 8,
    remaining: 0,
    partial: false,
    elapsedMs: 1000,
    ...overrides,
  };
}

/** Últimos stats gravados no IngestionRun. */
function finishedStats() {
  const calls = (prismaMock.ingestionRun.update as any).mock.calls;
  return calls.at(-1)[0].data.statsJson;
}

function finishedStatus() {
  const calls = (prismaMock.ingestionRun.update as any).mock.calls;
  return calls.at(-1)[0].data.status;
}

/** Define quantos exibíveis existem hoje (PENDING + READY). */
function inventario(n: number) {
  (prismaMock.shopeeAchadinhoProduct.count as any).mockResolvedValue(n);
}

beforeEach(() => {
  vi.clearAllMocks();
  getSetting.mockResolvedValue(null);
  inventario(0); // por padrão: abaixo do alvo
  (prismaMock.ingestionRun.create as any).mockResolvedValue({ id: "run-1" });
  (prismaMock.ingestionRun.update as any).mockResolvedValue({});
});

describe("gate de frequência", () => {
  it("pula quando houve execução completa recente", async () => {
    recentCompleteRun();

    const result = await runShopeeRankingsCron();

    expect(result).toBe(-1);
    expect(syncShopeeRankings).not.toHaveBeenCalled();
  });

  it("NÃO pula quando a última execução foi parcial", async () => {
    // Se pulasse, o backlog ficaria congelado pelo cooldown inteiro
    recentPartialRun();
    processAchadinhosBatch.mockResolvedValue(batchResult());

    const result = await runShopeeAchadinhosCron();

    expect(result).not.toBe(-1);
    expect(processAchadinhosBatch).toHaveBeenCalled();
  });

  it("roda quando não há execução anterior", async () => {
    noPreviousRun();
    syncShopeeRankings.mockResolvedValue(42);

    const result = await runShopeeRankingsCron();

    expect(result).toBe(42);
    expect(syncShopeeRankings).toHaveBeenCalled();
  });

  it("force=true ignora o gate", async () => {
    recentCompleteRun();
    syncShopeeRankings.mockResolvedValue(7);

    const result = await runShopeeRankingsCron(true);

    expect(result).toBe(7);
    expect(syncShopeeRankings).toHaveBeenCalled();
  });
});

describe("runShopeeRankingsCron — resultado da execução", () => {
  beforeEach(noPreviousRun);

  it("marca FAILED quando o sync lança", async () => {
    // Importante: uma indisponibilidade do fornecedor NÃO pode virar SUCCESS,
    // senão inicia o cooldown de 24h e bloqueia a retentativa.
    syncShopeeRankings.mockRejectedValue(new Error("Shopee fora do ar"));

    const result = await runShopeeRankingsCron();

    expect(result).toBe(0);
    expect(finishedStatus()).toBe("FAILED");
  });

  it("marca SUCCESS e grava a contagem no caminho feliz", async () => {
    syncShopeeRankings.mockResolvedValue(50);

    await runShopeeRankingsCron();

    expect(finishedStatus()).toBe("SUCCESS");
    expect(finishedStats()).toMatchObject({ synced: 50 });
  });
});

describe("runShopeeAchadinhosCron — lote e orçamento", () => {
  beforeEach(noPreviousRun);

  it("registra partial=true para que o próximo cron continue", async () => {
    processAchadinhosBatch.mockResolvedValue(
      batchResult({ partial: true, processed: 4, succeeded: 3, remaining: 6 }),
    );

    await runShopeeAchadinhosCron();

    expect(finishedStatus()).toBe("SUCCESS");
    expect(finishedStats()).toMatchObject({ partial: true, remaining: 6 });
  });

  it("registra partial=false quando o lote fecha", async () => {
    processAchadinhosBatch.mockResolvedValue(batchResult());

    await runShopeeAchadinhosCron();

    expect(finishedStats()).toMatchObject({ partial: false, remaining: 0 });
  });

  it("limita o alvo ao teto de 400", async () => {
    processAchadinhosBatch.mockResolvedValue(batchResult());

    await runShopeeAchadinhosCron(false, 9999);

    expect(processAchadinhosBatch).toHaveBeenCalledWith(
      expect.objectContaining({ targetInventory: 400 }),
    );
  });

  it("limita o alvo ao piso de 20", async () => {
    processAchadinhosBatch.mockResolvedValue(batchResult());

    await runShopeeAchadinhosCron(false, 1);

    expect(processAchadinhosBatch).toHaveBeenCalledWith(
      expect.objectContaining({ targetInventory: 20 }),
    );
  });

  it("countOverride tem prioridade sobre a Setting", async () => {
    getSetting.mockImplementation(async (key: string) =>
      key === "shopee.achadinhos_count" ? "50" : null,
    );
    processAchadinhosBatch.mockResolvedValue(batchResult());

    await runShopeeAchadinhosCron(false, 120);

    expect(processAchadinhosBatch).toHaveBeenCalledWith(
      expect.objectContaining({ targetInventory: 120 }),
    );
  });

  it("varre bem mais que a folga — o rendimento é baixo", async () => {
    // alvo 50, inventário 40 → folga 10 → varre 100
    inventario(40);
    processAchadinhosBatch.mockResolvedValue(batchResult());

    await runShopeeAchadinhosCron(false, 50);

    expect(processAchadinhosBatch).toHaveBeenCalledWith(
      expect.objectContaining({ count: 100, targetInventory: 50 }),
    );
  });

  it("ABAIXO do alvo: roda mesmo com execução completa recente", async () => {
    // Convergir rápido importa mais que respeitar a janela.
    inventario(10);
    recentCompleteRun();
    processAchadinhosBatch.mockResolvedValue(batchResult());

    const result = await runShopeeAchadinhosCron(false, 50);

    expect(result).not.toBe(-1);
    expect(processAchadinhosBatch).toHaveBeenCalled();
  });

  it("NO alvo + dentro da janela: pula", async () => {
    inventario(50);
    recentCompleteRun();

    const result = await runShopeeAchadinhosCron(false, 50);

    expect(result).toBe(-1);
    expect(processAchadinhosBatch).not.toHaveBeenCalled();
  });

  it("NO alvo mas janela vencida: roda para trazer conteúdo novo", async () => {
    // O alvo atingido não pode significar "nunca mais rodar" — senão o feed
    // congela no que já existe e envelhece.
    inventario(50);
    noPreviousRun();
    processAchadinhosBatch.mockResolvedValue(batchResult());

    const result = await runShopeeAchadinhosCron(false, 50);

    expect(result).not.toBe(-1);
    expect(processAchadinhosBatch).toHaveBeenCalled();
  });

  it("marca FAILED quando o lote lança", async () => {
    processAchadinhosBatch.mockRejectedValue(new Error("boom"));

    const result = await runShopeeAchadinhosCron();

    expect(result).toBe(0);
    expect(finishedStatus()).toBe("FAILED");
  });
});
