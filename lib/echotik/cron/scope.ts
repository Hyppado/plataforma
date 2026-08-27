/**
 * lib/echotik/cron/scope.ts — O que a plataforma consegue, de fato, exibir.
 *
 * POR QUE ISTO EXISTE
 * Vários jobs precisavam responder "esse item ainda interessa?" e cada um
 * respondia de um jeito. As divergências custaram caro:
 *
 *   - uploadImages perguntava "está na data mais recente?" — a data mais
 *     recente é a do ranking DIÁRIO, então os produtos que só aparecem no
 *     semanal e no mensal nunca ganhavam capa. Medido: 347 dos 1000 produtos
 *     do ranking semanal ficavam permanentemente sem imagem.
 *
 *   - cleanupOrphans perguntava "está na tabela de ranking?" — o que inclui
 *     região desativada e posição que a tela nunca alcança. Resultado: linhas
 *     de MX/GB/JP paradas desde março continuavam sendo tratadas como ativas,
 *     e as capas correspondentes, preservadas.
 *
 * Aqui a pergunta é única e igual à da interface: região habilitada e dentro
 * das 100 primeiras posições. Job que use outra definição volta a divergir.
 */

import { prisma } from "@/lib/prisma";

/**
 * Teto de posições que a interface consegue alcançar.
 *
 * A API limita `pageSize` a 100 (rotas em app/api/trending) e todo consumidor
 * pede a página 1 — o "Carregar mais" apenas revela mais dos 100 já baixados,
 * nunca busca a página seguinte. Guardar imagem da posição 101 em diante é
 * armazenamento que ninguém vê.
 */
export const DISPLAY_LIMIT = 100;

/** Códigos de região habilitados no painel admin (tabela Region). */
export async function getActiveRegionCodes(): Promise<string[]> {
  const rows = await prisma.region.findMany({
    where: { isActive: true },
    select: { code: true },
  });
  return rows.map((r) => r.code);
}

/**
 * IDs de produto que a plataforma pode exibir hoje.
 * Vazio significa "não sei" — nunca "pode apagar tudo". Quem consome deve
 * tratar o vazio como motivo para abortar, não para limpar.
 */
export async function getDisplayableProductIds(): Promise<string[]> {
  const regions = await getActiveRegionCodes();
  if (regions.length === 0) return [];

  const rows = await prisma.echotikProductTrendDaily.findMany({
    where: { country: { in: regions }, rankPosition: { lte: DISPLAY_LIMIT } },
    select: { productExternalId: true },
    distinct: ["productExternalId"],
  });
  return rows.map((r) => r.productExternalId).filter(Boolean);
}

/**
 * IDs de produto que devem SOBREVIVER a qualquer limpeza de EchotikProductDetail.
 *
 * A tabela alimenta duas telas com critérios diferentes, e por muito tempo cada
 * job só enxergava a sua:
 *
 *   - "Produtos em Alta" lê pelo ranking (top 100, região ativa).
 *   - "Novos Produtos" lê a própria EchotikProductDetail, filtrando por região
 *     e ordenando por fetchedAt — sem passar pelo ranking.
 *
 * Com isso, syncNewProducts purgava por firstCrawlDt e derrubava as linhas dos
 * produtos ranqueados (levando junto o vínculo com a capa já subida), enquanto
 * cleanupOrphans purgava por ranking e derrubava as linhas dos novos produtos.
 * Um desfazia o trabalho do outro, e as capas viravam arquivo sem dono.
 *
 * A união das duas necessidades é o único critério seguro.
 */
export async function getRetainableProductIds(
  newProductsMinCrawlDt: number,
): Promise<string[]> {
  const [exibiveis, novos] = await Promise.all([
    getDisplayableProductIds(),
    prisma.echotikProductDetail.findMany({
      where: { firstCrawlDt: { gte: newProductsMinCrawlDt } },
      select: { productExternalId: true },
    }),
  ]);
  return Array.from(
    new Set([...exibiveis, ...novos.map((n) => n.productExternalId)]),
  );
}

/** IDs de criador que a plataforma pode exibir hoje. */
export async function getDisplayableCreatorIds(): Promise<string[]> {
  const regions = await getActiveRegionCodes();
  if (regions.length === 0) return [];

  const rows = await prisma.echotikCreatorTrendDaily.findMany({
    where: { country: { in: regions }, rankPosition: { lte: DISPLAY_LIMIT } },
    select: { userExternalId: true },
    distinct: ["userExternalId"],
  });
  return rows.map((r) => r.userExternalId).filter(Boolean);
}
