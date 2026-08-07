/**
 * Script de reparo — capas dos "Achadinhos Shopee".
 *
 * PROBLEMA
 * A EchoTik devolve a capa do vídeo como URL assinada do CDN do TikTok, com
 * `x-expires` na query. O pipeline gravava essa URL crua, então as capas
 * passavam a responder 403 poucas horas depois da ingestão.
 *
 * O pipeline já foi corrigido (cacheCoverToBlob persiste a imagem no Vercel
 * Blob no momento da ingestão), mas registros antigos continuam apontando
 * para URLs expiradas — e como o pipeline pula registros READY/PENDING, eles
 * nunca se recuperam sozinhos.
 *
 * O QUE ESTE SCRIPT FAZ
 * Rebusca a lista de vídeos da hashtag na EchoTik (capas novas, válidas),
 * casa por videoExternalId e regrava a capa no Blob.
 *
 * Vídeos que já saíram da hashtag não têm como ser recuperados — a URL antiga
 * está morta e não há de onde baixar. Eles são reportados no final.
 *
 * Uso:
 *   npx tsx prisma/repairAchadinhoCovers.ts --dry-run
 *   npx tsx prisma/repairAchadinhoCovers.ts
 *
 * Aponte DATABASE_URL para o ambiente que quer reparar.
 */
import { PrismaClient } from "@prisma/client";
import { fetchVideosByHashtag } from "@/lib/echotik/client";
import {
  mapAwemeListToVideos,
  getAchadinhosHashtagIds,
} from "@/lib/shopee/client";
import { cacheCoverToBlob } from "@/lib/shopee/pipeline";

const prisma = new PrismaClient();

const PAGE_SIZE = 20;
const PAGE_DELAY_MS = 2_000;
/** Quantas páginas varrer atrás de capas novas (20 vídeos por página) */
const MAX_PAGES = 20;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isPermanent(url: string | null): boolean {
  return !!url && url.includes(".public.blob.vercel-storage.com");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // 1. Quem precisa de reparo
  const all = await prisma.shopeeAchadinhoProduct.findMany({
    select: { id: true, videoExternalId: true, coverUrl: true, status: true },
  });
  const broken = all.filter((r) => !isPermanent(r.coverUrl));

  console.log(`Achadinhos no banco: ${all.length}`);
  console.log(`  já com capa permanente: ${all.length - broken.length}`);
  console.log(`  precisando de reparo:   ${broken.length}`);

  if (broken.length === 0) {
    console.log("\nNada a reparar.");
    return;
  }

  // 2. Rebuscar capas novas na hashtag
  const hashtagIds = await getAchadinhosHashtagIds();
  const fresh = new Map<string, string>(); // videoExternalId -> coverUrl novo
  const wanted = new Set(broken.map((r) => r.videoExternalId));
  const seen = new Set<string>(); // dedup entre páginas e hashtags

  console.log(`\nVarrendo ${hashtagIds.length} hashtag(s) atrás de capas novas...`);

  for (const hashtagId of hashtagIds) {
  if (fresh.size >= wanted.size) break;
  console.log(`  hashtag ${hashtagId}`);
  for (let page = 0; page < MAX_PAGES && fresh.size < wanted.size; page++) {
    let response;
    try {
      response = await fetchVideosByHashtag({
        hashtagId,
        region: "BR",
        count: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
    } catch (error) {
      console.warn(
        `  página ${page + 1} falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
      break;
    }

    const items = response?.data?.aweme_list ?? [];
    if (items.length === 0) break;

    // A EchoTik devolve rotineiramente menos itens do que o pedido (19 para
    // count=20), então "página curta" NÃO significa fim da lista. Paginamos
    // enquanto houver itens e o offset estiver de fato avançando.
    let novos = 0;
    for (const v of mapAwemeListToVideos(items)) {
      if (!seen.has(v.video_id)) {
        seen.add(v.video_id);
        novos++;
      }
      if (wanted.has(v.video_id) && v.cover_url && !fresh.has(v.video_id)) {
        fresh.set(v.video_id, v.cover_url);
      }
    }

    console.log(
      `  página ${page + 1}: ${items.length} vídeos (${novos} novos), ${fresh.size}/${wanted.size} capas encontradas`,
    );

    // Sem vídeos novos = offset não avança, não adianta continuar
    if (novos === 0) break;
    if (response?.data?.has_more === 0) break;

    await sleep(PAGE_DELAY_MS);
  }
  }

  const recoverable = broken.filter((r) => fresh.has(r.videoExternalId));
  const unrecoverable = broken.filter((r) => !fresh.has(r.videoExternalId));

  console.log(`\nRecuperáveis: ${recoverable.length}`);
  console.log(`Sem capa nova disponível: ${unrecoverable.length}`);

  if (dryRun) {
    console.log("\n[dry-run] Nada foi gravado. Rode sem --dry-run para aplicar.");
    return;
  }

  // 3. Baixar e persistir no Blob
  let repaired = 0;
  for (const record of recoverable) {
    const blobUrl = await cacheCoverToBlob(
      record.videoExternalId,
      fresh.get(record.videoExternalId),
    );

    if (blobUrl && isPermanent(blobUrl)) {
      await prisma.shopeeAchadinhoProduct.update({
        where: { id: record.id },
        data: { coverUrl: blobUrl },
      });
      repaired++;
    } else {
      console.warn(`  falhou ao persistir capa de ${record.videoExternalId}`);
    }
  }

  console.log(`\n${repaired} capas reparadas.`);
  if (unrecoverable.length > 0) {
    console.log(
      `${unrecoverable.length} continuam quebradas (vídeo saiu da hashtag — não há de onde baixar):`,
    );
    for (const r of unrecoverable.slice(0, 10)) {
      console.log(`  ${r.videoExternalId} (${r.status})`);
    }
    if (unrecoverable.length > 10) console.log(`  ... e mais ${unrecoverable.length - 10}`);
  }
}

main()
  .catch((error) => {
    console.error("Falha ao reparar capas:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
