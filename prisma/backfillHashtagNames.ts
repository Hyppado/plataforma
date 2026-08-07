/**
 * Script de migração — nomes das hashtags dos "Achadinhos Shopee".
 *
 * CONTEXTO
 * A setting `shopee.achadinhos_hashtag_id` guardava só os IDs, e a aba de
 * configuração redescobria os nomes rodando uma busca na EchoTik a cada
 * abertura. Como essa busca falha com frequência (risk control), os chips
 * sumiam da tela e salvar nesse estado apagava a configuração.
 *
 * O formato passou a ser `id|nome`. Este script preenche o nome das hashtags
 * gravadas no formato antigo, para que elas não fiquem aparecendo como um
 * número cru até o admin reescolher cada uma.
 *
 * COMO O NOME É DESCOBERTO
 * Não existe endpoint de consulta por ID na EchoTik. Duas fontes se
 * complementam, porque os IDs configurados vêm de duas famílias:
 *
 * 1. `hashtag/search` — devolve id + nome. Cobre os IDs internos da EchoTik
 *    (16 dígitos, ex: 1696392324325382). Endpoint instável: responde risk
 *    control com frequência, daí as tentativas.
 * 2. `hashtag/video/list` → `cha_list` de cada vídeo, que traz `cid` e
 *    `cha_name`. Cobre os challenge IDs do TikTok (19 dígitos, ex:
 *    7305788026466664454), que não aparecem na busca.
 *
 * O script é idempotente: só preenche nome vazio. Se uma fonte estiver fora
 * do ar, rode de novo mais tarde para completar o que faltou.
 *
 * Uso:
 *   npx tsx prisma/backfillHashtagNames.ts --dry-run
 *   npx tsx prisma/backfillHashtagNames.ts
 *
 * Aponte DATABASE_URL para o ambiente que quer migrar.
 */
import { PrismaClient } from "@prisma/client";
import { fetchVideosByHashtag, searchHashtags } from "@/lib/echotik/client";
import {
  parseAchadinhoHashtags,
  serializeAchadinhoHashtags,
} from "@/lib/shopee/types";

const prisma = new PrismaClient();

const SETTING_KEY = "shopee.achadinhos_hashtag_id";
/** A EchoTik responde risk control com frequência — vale insistir. */
const TENTATIVAS = 3;
const DELAY_MS = 2_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Termos usados para varrer a busca atrás dos IDs internos da EchoTik. */
const TERMOS_BUSCA = ["achadinho", "achadinhos", "achadinhosshopee"];

/**
 * Monta um índice id -> nome varrendo a busca. Best-effort: cada termo que
 * falhar é apenas pulado, e os IDs não cobertos caem no `cha_list`.
 */
async function indexarPelaBusca(): Promise<Map<string, string>> {
  const indice = new Map<string, string>();

  for (const termo of TERMOS_BUSCA) {
    try {
      const resultados = await searchHashtags({ keyword: termo, region: "BR" });
      for (const h of resultados ?? []) {
        const id = String((h as { id?: unknown }).id ?? "");
        const nome = (h as { name?: unknown }).name;
        if (id && typeof nome === "string" && !indice.has(id)) {
          indice.set(id, nome);
        }
      }
      console.log(`  busca "${termo}": ${(resultados ?? []).length} resultados`);
    } catch (error) {
      console.warn(
        `  busca "${termo}" falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await sleep(DELAY_MS);
  }

  return indice;
}

/** Descobre o nome de uma hashtag pelo `cha_list` dos vídeos dela. */
async function resolverNome(hashtagId: string): Promise<string | null> {
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const resposta = await fetchVideosByHashtag({
        hashtagId,
        region: "BR",
        count: 5,
        offset: 0,
      });

      for (const item of resposta?.data?.aweme_list ?? []) {
        const chaList = (item as { cha_list?: { cid?: unknown; cha_name?: unknown }[] })
          .cha_list;
        for (const cha of chaList ?? []) {
          if (String(cha.cid) === hashtagId && typeof cha.cha_name === "string") {
            return cha.cha_name;
          }
        }
      }

      // Respondeu, mas o cid não estava em nenhum cha_list — insistir não ajuda
      return null;
    } catch (error) {
      console.warn(
        `  tentativa ${tentativa}/${TENTATIVAS} falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (tentativa < TENTATIVAS) await sleep(DELAY_MS);
    }
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!setting?.value) {
    console.log("Nenhuma hashtag configurada. Nada a fazer.");
    return;
  }

  const tags = parseAchadinhoHashtags(setting.value);
  const semNome = tags.filter((t) => !t.name);

  console.log(`Hashtags configuradas: ${tags.length}`);
  console.log(`  já com nome: ${tags.length - semNome.length}`);
  console.log(`  sem nome:    ${semNome.length}`);

  if (semNome.length === 0) {
    console.log("\nNada a migrar.");
    return;
  }

  console.log("\nFonte 1 — busca por nome:");
  const porBusca = await indexarPelaBusca();

  console.log("\nResolvendo:");
  const resolvidos = new Map<string, string>();
  for (const tag of semNome) {
    const daBusca = porBusca.get(tag.id);
    if (daBusca) {
      resolvidos.set(tag.id, daBusca);
      console.log(`  ${tag.id} -> #${daBusca} (busca)`);
      continue;
    }

    const nome = await resolverNome(tag.id);
    if (nome) {
      resolvidos.set(tag.id, nome);
      console.log(`  ${tag.id} -> #${nome} (cha_list)`);
    } else {
      console.log(`  ${tag.id} -> não foi possível resolver`);
    }
    await sleep(DELAY_MS);
  }

  if (resolvidos.size === 0) {
    console.log("\nNenhum nome resolvido. A configuração continua válida — os");
    console.log("IDs seguem funcionando, só aparecem crus na tela.");
    return;
  }

  const atualizadas = tags.map((t) => ({
    id: t.id,
    name: t.name || resolvidos.get(t.id) || "",
  }));
  const novoValor = serializeAchadinhoHashtags(atualizadas);

  // Trava de segurança: a migração é só de nomes. Se o conjunto de IDs mudou,
  // algo está errado e é melhor não gravar.
  const idsAntes = tags.map((t) => t.id).join(",");
  const idsDepois = parseAchadinhoHashtags(novoValor).map((t) => t.id).join(",");
  if (idsAntes !== idsDepois) {
    console.error("\nABORTADO: o conjunto de IDs mudaria.");
    console.error(`  antes:  ${idsAntes}`);
    console.error(`  depois: ${idsDepois}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nValor novo:\n  ${novoValor}`);

  if (dryRun) {
    console.log("\n[dry-run] Nada foi gravado. Rode sem --dry-run para aplicar.");
    return;
  }

  await prisma.setting.update({
    where: { key: SETTING_KEY },
    data: { value: novoValor },
  });
  console.log(`\n${resolvidos.size} nome(s) gravado(s).`);
}

main()
  .catch((error) => {
    console.error("Falha ao migrar nomes das hashtags:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
