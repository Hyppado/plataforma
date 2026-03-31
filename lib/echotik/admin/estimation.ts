/**
 * lib/echotik/admin/estimation.ts
 *
 * Echotik API request volume estimation.
 *
 * Given a configuration (real or hypothetical), calculates exactly how many
 * HTTP requests the ingestion system will make per day to the Echotik API.
 *
 * The calculation is based on the actual ingestion logic:
 *   - 1 probe call per (cycle × field) to discover available dates
 *   - N page calls per cycle × field × region × pages
 *   - categories: once per interval, no region
 *
 * This is used to preview the impact of configuration changes before saving.
 */

import type {
  EntityEstimate,
  EstimationInput,
  EstimationResult,
} from "@/lib/types/echotik-admin";

// Fixed structural constants (driven by Echotik API structure, not configurable)
const RANKING_CYCLES = 3; // daily, weekly, monthly
const RANK_FIELDS_PER_ENTITY = 2; // e.g. sales + views for videos
const CATEGORY_CALLS_PER_SYNC = 4; // L1 + L2 + L3 + languages
const DETAIL_CALLS_PER_BATCH = 1; // 1 API call per batch of N products
const CRON_INTERVAL_MINUTES = 15;
const MINUTES_PER_DAY = 60 * 24;

/**
 * Estimates total Echotik API request volume from the given configuration.
 * Can be called with a hypothetical config to preview impact before saving.
 */
export function estimateEchotikRequests(
  input: EstimationInput,
): EstimationResult {
  const notes: string[] = [];
  const breakdown: EntityEstimate[] = [];

  const cronTicksPerDay = MINUTES_PER_DAY / input.cronIntervalMinutes; // 96 ticks/day

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------
  const categoriesEnabled = input.enabledTasks.includes("categories");
  const categoryInvocationsPerDay = categoriesEnabled
    ? 24 / input.categoriesIntervalHours // e.g. 24h interval → 1/day
    : 0;
  const categoryRequestsPerInvocation = categoriesEnabled
    ? CATEGORY_CALLS_PER_SYNC
    : 0;
  const categoryRequestsPerDay =
    categoryInvocationsPerDay * categoryRequestsPerInvocation;

  breakdown.push({
    entity: "categories",
    requestsPerInvocation: categoryRequestsPerInvocation,
    invocationsPerDay: categoryInvocationsPerDay,
    requestsPerDay: categoryRequestsPerDay,
    probeCallsPerInvocation: 0,
    dataCallsPerInvocation: categoryRequestsPerInvocation,
    regions: 1,
    enabled: categoriesEnabled,
  });

  // -------------------------------------------------------------------------
  // Helper for ranklist tasks (videos, products, creators)
  // -------------------------------------------------------------------------
  function ranklistEstimate(
    entity: "videos" | "products" | "creators",
    pages: number,
    intervalHours: number,
  ): EntityEstimate {
    const enabled = input.enabledTasks.includes(entity);
    if (!enabled || input.activeRegions === 0) {
      return {
        entity,
        requestsPerInvocation: 0,
        invocationsPerDay: 0,
        requestsPerDay: 0,
        probeCallsPerInvocation: 0,
        dataCallsPerInvocation: 0,
        regions: input.activeRegions,
        enabled: false,
      };
    }

    // Per invocation (1 region):
    //   probe calls: RANKING_CYCLES × RANK_FIELDS (1 call each to find available date)
    //   data calls: RANKING_CYCLES × RANK_FIELDS × pages
    const probeCallsPerInvocation = RANKING_CYCLES * RANK_FIELDS_PER_ENTITY;
    const dataCallsPerInvocation =
      RANKING_CYCLES * RANK_FIELDS_PER_ENTITY * pages;
    const requestsPerInvocation =
      probeCallsPerInvocation + dataCallsPerInvocation;

    // Invocations per day: one per region per interval
    const syncCyclesPerDay = 24 / intervalHours;
    const invocationsPerDay = syncCyclesPerDay * input.activeRegions;

    const requestsPerDay = invocationsPerDay * requestsPerInvocation;

    return {
      entity,
      requestsPerInvocation,
      invocationsPerDay,
      requestsPerDay,
      probeCallsPerInvocation,
      dataCallsPerInvocation,
      regions: input.activeRegions,
      enabled: true,
    };
  }

  const videosEstimate = ranklistEstimate(
    "videos",
    input.videoPages,
    input.videosIntervalHours,
  );
  const productsEstimate = ranklistEstimate(
    "products",
    input.productPages,
    input.productsIntervalHours,
  );
  const creatorsEstimate = ranklistEstimate(
    "creators",
    input.creatorPages,
    input.creatorsIntervalHours,
  );

  breakdown.push(videosEstimate, productsEstimate, creatorsEstimate);

  // -------------------------------------------------------------------------
  // Product details enrichment
  // -------------------------------------------------------------------------
  // Hard to estimate precisely without knowing actual backlog size.
  // We estimate based on items produced by video + product syncs.
  const detailsEnabled = input.enabledTasks.includes("details");
  const estimatedProductsPerDay =
    videosEstimate.requestsPerDay > 0
      ? input.videoPages * 10 * input.activeRegions // rough: 10 items/page × pages × regions
      : 0;
  const detailCallsPerDay = detailsEnabled
    ? Math.ceil(estimatedProductsPerDay / input.detailBatchSize) *
      DETAIL_CALLS_PER_BATCH
    : 0;

  breakdown.push({
    entity: "details",
    requestsPerInvocation:
      input.detailBatchSize > 0 ? DETAIL_CALLS_PER_BATCH : 0,
    invocationsPerDay: detailCallsPerDay,
    requestsPerDay: detailCallsPerDay,
    probeCallsPerInvocation: 0,
    dataCallsPerInvocation: DETAIL_CALLS_PER_BATCH,
    regions: input.activeRegions,
    enabled: detailsEnabled,
  });

  notes.push(
    "Enriquecimento de detalhes é uma estimativa baseada no volume esperado de itens; as chamadas reais dependem da taxa de cache.",
  );
  notes.push(
    "Chamadas de verificação (probe) são 1 requisição por (ciclo × campo) para descobrir a data mais recente disponível.",
  );
  notes.push(
    `O cron roda a cada ${input.cronIntervalMinutes} minutos (${cronTicksPerDay} execuções/dia). Cada execução processa no máximo 1 tarefa × 1 região.`,
  );

  const totalRequestsPerDay = breakdown.reduce(
    (acc, e) => acc + e.requestsPerDay,
    0,
  );

  // Total invocations per day (capped by cron tick capacity)
  const totalInvocationsPerDay = breakdown.reduce(
    (acc, e) => acc + e.invocationsPerDay,
    0,
  );

  if (totalInvocationsPerDay > cronTicksPerDay) {
    notes.push(
      `⚠️ Estimativa de ${Math.round(totalInvocationsPerDay)} invocações/dia excede ${cronTicksPerDay} execuções/dia disponíveis no cron. Algumas tarefas podem não completar dentro do intervalo esperado.`,
    );
  }

  return {
    input,
    breakdown,
    totalRequestsPerDay: Math.round(totalRequestsPerDay),
    requestsPerCronTick: requestsPerCronTick(breakdown),
    invocationsPerDay: Math.round(totalInvocationsPerDay),
    notes,
  };
}

function requestsPerCronTick(breakdown: EntityEstimate[]): number {
  // A single cron tick runs exactly 1 invocation.
  // We return the max single-invocation request count as a "worst case per tick".
  return Math.max(...breakdown.map((e) => e.requestsPerInvocation), 0);
}

/**
 * Builds an EstimationInput from a real EchotikConfig + active region count.
 */
export function configToEstimationInput(
  config: import("@/lib/types/echotik-admin").EchotikConfig,
  activeRegionsCount: number,
): EstimationInput {
  return {
    activeRegions: activeRegionsCount,
    videoPages: config.pages.videos,
    productPages: config.pages.products,
    creatorPages: config.pages.creators,
    detailBatchSize: config.detail.batchSize,
    rankingCycles: RANKING_CYCLES,
    rankFields: RANK_FIELDS_PER_ENTITY,
    categoriesIntervalHours: config.intervals.categories,
    videosIntervalHours: config.intervals.videos,
    productsIntervalHours: config.intervals.products,
    creatorsIntervalHours: config.intervals.creators,
    enabledTasks: config.enabledTasks,
    cronIntervalMinutes: CRON_INTERVAL_MINUTES,
  };
}
