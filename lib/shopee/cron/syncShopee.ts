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
import { processAchadinhosBatch, trimAchadinhosToTarget } from "../pipeline";
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
 * O número configurado é um ALVO de achadinhos exibíveis (PENDING + READY),
 * não "quantos vídeos varrer". Abaixo do alvo o cron roda mesmo dentro da
 * janela de frequência, para convergir rápido; no alvo, volta a respeitar a
 * cadência — e roda de novo quando ela vence, trazendo conteúdo novo.
 *
 * @param force - Se true, ignora a verificação de frequência
 * @param countOverride - Alvo dinâmico (20-400), sobrescreve a setting
 * @returns Número de achadinhos criados com sucesso, ou -1 se pulou
 */
export async function runShopeeAchadinhosCron(
  force = false,
  countOverride?: number,
): Promise<number> {
  const freqSetting = await getSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_FREQUENCY);
  const intervalHours = freqSetting ? parseInt(freqSetting, 10) : SHOPEE_DEFAULTS.ACHADINHOS_FREQUENCY_HOURS;

  // ALVO de achadinhos exibíveis (não "quantos vídeos varrer").
  // O admin configura quantos itens quer disponíveis no feed.
  let alvo: number;
  if (countOverride !== undefined) {
    alvo = Math.min(400, Math.max(20, countOverride));
  } else {
    const countSetting = await getSetting(SETTING_KEYS.SHOPEE_ACHADINHOS_COUNT);
    alvo = countSetting
      ? Math.min(400, Math.max(20, parseInt(countSetting, 10) || SHOPEE_DEFAULTS.ACHADINHOS_COUNT))
      : SHOPEE_DEFAULTS.ACHADINHOS_COUNT;
  }

  // ROTAÇÃO ANTES DO GATE, de propósito.
  //
  // Manter o feed no tamanho configurado não pode depender de haver ingestão.
  // O admin aprova achadinhos a qualquer momento e o READY passa do alvo na
  // hora; se a poda só rodasse depois do lote, o feed ficaria acima do alvo
  // até a próxima janela de renovação — foram 103/100 por horas em produção.
  //
  // Rodar aqui é equivalente a rodar depois: o lote só cria registros PENDING
  // (o gate de aprovação existe justamente para isso), então ele nunca muda a
  // contagem de READY que a poda usa.
  const archived = await trimAchadinhosToTarget(alvo);

  const exibiveis = await prisma.shopeeAchadinhoProduct.count({
    where: { status: { in: ["PENDING", "READY"] } },
  });
  const abaixoDoAlvo = exibiveis < alvo;

  const skipKey = "shopee:achadinhos";

  // Composição do gate:
  // - ABAIXO do alvo → roda agora, ignorando o cooldown. É assim que o
  //   inventário converge rápido em vez de esperar a próxima janela.
  // - NO alvo → respeita a cadência normal. Não é "nunca mais rodar": quando
  //   a janela vence, roda de novo para trazer conteúdo novo, senão o feed
  //   envelhece e congela no que já existe.
  if (!force && !abaixoDoAlvo && (await shouldSkipShopeeTask(skipKey, intervalHours))) {
    log.info(
      `Cron de achadinhos: pulando — alvo já atingido (${exibiveis}/${alvo}) e dentro da janela de ${intervalHours}h` +
        (archived > 0 ? ` · ${archived} antigos arquivados` : ""),
    );
    return -1;
  }

  if (abaixoDoAlvo) {
    log.info(
      `Abaixo do alvo (${exibiveis}/${alvo}) — rodando mesmo dentro da janela de ${intervalHours}h`,
    );
  }

  // RENOVAÇÃO — chegar no alvo não é "nunca mais buscar".
  //
  // Se já estamos no alvo e o gate acima deixou passar, é porque a janela de
  // frequência venceu: a intenção é trazer conteúdo NOVO. O teto de inventário
  // sobe para (alvo + alvo) para o lote poder produzir; depois do lote, os
  // publicados mais antigos são aposentados de volta para o alvo.
  //
  // Sem isto o lote quebrava no primeiro vídeo (`exibíveis >= alvo`) e o feed
  // congelava para sempre no acervo do dia em que o alvo foi alcançado.
  const renovando = !abaixoDoAlvo;
  const teto = renovando ? alvo * 2 : alvo;

  if (renovando) {
    log.info(
      `No alvo (${exibiveis}/${alvo}) e janela de ${intervalHours}h vencida — ` +
        `renovando: buscando até ${alvo} achadinhos novos`,
    );
  }

  const run = await createIngestionRun(skipKey);

  try {
    log.info("Cron de achadinhos Shopee iniciado...", { alvo, exibiveis, renovando });

    // O lote descobre, filtra o que já foi processado e roda em série dentro
    // de um orçamento de tempo, persistindo cada vídeo. Se o orçamento acabar,
    // devolve `partial: true` e o próximo cron continua de onde parou.
    const result = await processAchadinhosBatch({
      region: "BR",
      // Quanto varrer por execução: a folga até o teto, com um piso para não
      // fazer varreduras minúsculas. O rendimento é baixo (~4% dos vídeos
      // viram achadinho), então buscamos bem mais do que falta.
      count: Math.min(400, Math.max(20, (teto - exibiveis) * 10)),
      targetInventory: teto,
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
      target: alvo,
      ceiling: teto,
      renewal: renovando,
      archived,
      inventory: result.inventory ?? exibiveis,
      targetReached: !!result.targetReached,
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
