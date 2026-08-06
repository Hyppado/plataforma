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
import { processAchadinhosBatch } from "../pipeline";
import { SHOPEE_DEFAULTS } from "@/lib/shopee/types";

const log = createLogger("shopee/cron");

/**
 * Verifica se uma tarefa deve ser pulada baseado na frequência configurada.
 *
 * IMPORTANTE — lotes parciais não iniciam o cooldown.
 * O lote de achadinhos pode encerrar antes do fim por orçamento de tempo
 * (limite de execução da Vercel) e registra `statsJson.partial = true`.
 * Se um lote parcial contasse como execução completa, o cooldown de 12h
 * congelaria a fila e o backlog nunca seria drenado. Só uma execução que
 * processou tudo que havia inicia o intervalo.
 *
 * @param skipKey - Identificador único da tarefa (ex: "shopee:ranking")
 * @param intervalHours - Número de horas entre execuções
 * @returns true se deve pular (já executou por completo dentro do intervalo)
 */
async function shouldSkipShopeeTask(skipKey: string, intervalHours: number): Promise<boolean> {
  const threshold = new Date(Date.now() - intervalHours * 60 * 60 * 1000);
  const lastRun = await prisma.ingestionRun.findFirst({
    where: {
      source: skipKey,
      status: "SUCCESS",
      startedAt: { gte: threshold },
    },
    orderBy: { startedAt: "desc" },
  });

  if (!lastRun) return false;

  // Lote parcial → não pula, há backlog esperando
  const stats = lastRun.statsJson as { partial?: boolean } | null;
  if (stats?.partial === true) {
    log.info(
      `${skipKey}: última execução foi parcial — seguindo para drenar o backlog`,
    );
    return false;
  }

  return true;
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
  stats?: Record<string, number | string | boolean>,
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

    // O lote descobre, filtra o que já foi processado e roda em série dentro
    // de um orçamento de tempo, persistindo cada vídeo. Se o orçamento acabar,
    // devolve `partial: true` e o próximo cron continua de onde parou.
    const result = await processAchadinhosBatch({
      region: "BR",
      count: achadinhosCount,
    });

    await finishIngestionRun(run.id, "SUCCESS", {
      found: result.found,
      alreadyProcessed: result.alreadyProcessed,
      processed: result.processed,
      success: result.succeeded,
      remaining: result.remaining,
      // Lido por shouldSkipShopeeTask — um lote parcial não inicia o cooldown
      partial: result.partial,
      elapsedMs: result.elapsedMs,
      requestedCount: achadinhosCount,
    });

    log.info(
      `Cron de achadinhos finalizado. Sucesso: ${result.succeeded}/${result.processed}` +
        (result.partial ? ` — ${result.remaining} restantes para a próxima execução` : ""),
    );
    return result.succeeded;
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
