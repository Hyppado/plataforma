/**
 * lib/shopee/cron/syncShopee.ts
 *
 * Cron job dedicado para o ranking Shopee e pipeline de IA "Achadinhos Shopee".
 * Impede chamadas redundantes para manter baixos custos de API.
 *
 * As frequências de execução são lidas da tabela Setting,
 * com fallback para as constantes padrão em lib/shopee/types.ts.
 */

import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { syncShopeeRankings } from "../client";
import { processAchadinhosPipeline, saveAchadinhoFromPipelineItem } from "../pipeline";
import { SHOPEE_DEFAULTS } from "@/lib/shopee/types";

const log = createLogger("shopee/cron");

/**
 * Verifica se uma tarefa deve ser pulada baseado na frequência configurada.
 *
 * @param skipKey - Identificador único da tarefa (ex: "shopee:ranking")
 * @param intervalHours - Número de horas entre execuções
 * @returns true se deve pular (já executou dentro do intervalo)
 */
async function shouldSkipShopeeTask(skipKey: string, intervalHours: number): Promise<boolean> {
  const threshold = new Date(Date.now() - intervalHours * 60 * 60 * 1000);
  const lastRun = await prisma.ingestionRun.findFirst({
    where: {
      source: skipKey,
      status: "SUCCESS",
      startedAt: { gte: threshold },
    },
  });
  return !!lastRun;
}

/**
 * Cria um registro de execução no banco para auditoria.
 */
async function createIngestionRun(skipKey: string) {
  return prisma.ingestionRun.create({
    data: { source: skipKey, status: "RUNNING" },
  });
}

/**
 * Finaliza um registro de execução com sucesso ou falha.
 */
async function finishIngestionRun(
  runId: string,
  status: "SUCCESS" | "FAILED",
  stats?: Record<string, number | string>,
  errorMessage?: string,
) {
  const data: Record<string, unknown> = {
    status,
    endedAt: new Date(),
  };
  if (stats) data.statsJson = stats;
  if (errorMessage) data.errorMessage = errorMessage;
  return prisma.ingestionRun.update({
    where: { id: runId },
    data: data as any,
  });
}

/**
 * Executa a sincronização do ranking de produtos Shopee.
 *
 * @param force - Se true, ignora a verificação de frequência
 * @returns Número de itens sincronizados, ou -1 se pulou
 */
export async function runShopeeRankingsCron(force = false): Promise<number> {
  const freqSetting = await getSetting(SETTING_KEYS.SHOPEE_RANKING_FREQUENCY);
  const intervalHours = freqSetting ? parseInt(freqSetting, 10) : SHOPEE_DEFAULTS.RANKING_FREQUENCY_HOURS;

  const skipKey = "shopee:ranking";
  if (!force && (await shouldSkipShopeeTask(skipKey, intervalHours))) {
    log.info("Cron do ranking Shopee: pulando (já sincronizado recentemente)");
    return -1;
  }

  const run = await createIngestionRun(skipKey);

  try {
    const syncedCount = await syncShopeeRankings();
    await finishIngestionRun(run.id, "SUCCESS", { synced: syncedCount });
    return syncedCount;
  } catch (error) {
    log.error("Cron do ranking Shopee falhou", { error });
    await finishIngestionRun(
      run.id,
      "FAILED",
      undefined,
      error instanceof Error ? error.message : String(error),
    );
    return 0;
  }
}

/**
 * Executa o scan automatizado e pipeline de IA para "Achadinhos Shopee".
 *
 * @param force - Se true, ignora a verificação de frequência
 * @param countOverride - Quantidade dinâmica de vídeos (20-400).
 *   Se fornecido, sobrescreve o valor do banco/painel admin.
 * @returns Número de vídeos processados com sucesso, ou -1 se pulou
 */
export async function runShopeeAchadinhosCron(
  force = false,
  countOverride?: number,
): Promise<number> {
  const freqSetting = await getSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_FREQUENCY);
  const intervalHours = freqSetting ? parseInt(freqSetting, 10) : SHOPEE_DEFAULTS.ACHADINHOS_FREQUENCY_HOURS;

  // Quantidade de vídeos a buscar por execução — configurável no painel admin.
  // O admin define entre 20 e 400 (paginação segura em blocos de 20 com delay).
  // Se countOverride for passado (ex: via query param do cron), ele sobrescreve
  // o valor do banco.
  let achadinhosCount: number;
  if (countOverride !== undefined) {
    achadinhosCount = Math.min(400, Math.max(20, countOverride));
  } else {
    const countSetting = await getSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_COUNT);
    achadinhosCount = countSetting
      ? Math.min(400, Math.max(20, parseInt(countSetting, 10) || SHOPEE_DEFAULTS.ACHADINHOS_COUNT))
      : SHOPEE_DEFAULTS.ACHADINHOS_COUNT;
  }

  const skipKey = "shopee:achadinhos";
  if (!force && (await shouldSkipShopeeTask(skipKey, intervalHours))) {
    log.info("Cron de achadinhos Shopee: pulando (já processado recentemente)");
    return -1;
  }

  const run = await createIngestionRun(skipKey);

  try {
    log.info("Cron de achadinhos Shopee iniciado...", { count: achadinhosCount });

    // 1. Pipeline (Passo 1 + Passo 2): busca vídeos da hashtag com paginação
    //    segura (blocos de 20 + delay ~2s) e transcrição via Captions,
    //    com fallback Whisper fast-fail.
    const items = await processAchadinhosPipeline({ region: "BR", count: achadinhosCount });
    log.info(`${items.length} vídeos com transcrição encontrados para processar.`);

    let successCount = 0;

    // Processa sequencialmente para evitar estouro de rate limit
    for (const item of items) {
      const success = await saveAchadinhoFromPipelineItem(item);
      if (success) successCount++;
    }

    await finishIngestionRun(run.id, "SUCCESS", {
      found: items.length,
      success: successCount,
      requestedCount: achadinhosCount,
    });

    log.info(`Cron de achadinhos finalizado. Sucesso: ${successCount}/${items.length}`);
    return successCount;
  } catch (error) {
    log.error("Cron de achadinhos Shopee falhou", { error });
    await finishIngestionRun(
      run.id,
      "FAILED",
      undefined,
      error instanceof Error ? error.message : String(error),
    );
    return 0;
  }
}
