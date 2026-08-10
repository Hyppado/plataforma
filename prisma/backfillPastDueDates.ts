/**
 * Preenche `nextChargeAt` das assinaturas inadimplentes a partir da Hotmart.
 *
 * PROBLEMA
 * Auditoria de 2026-08-10: 58 das 70 assinaturas PAST_DUE não tinham NENHUMA
 * data de fim (`nextChargeAt` e `endedAt` nulos). O painel mostrava
 * inadimplente sem dizer até quando o acesso vale, e não havia como saber se
 * a carência já deveria ter acabado.
 *
 * A informação existe do lado da Hotmart: `date_next_charge` no endpoint
 * /payments/api/v1/subscriptions. Ela some para nós porque o webhook
 * PURCHASE_DELAYED nem sempre traz a próxima data de cobrança.
 *
 * ESTE SCRIPT NÃO MUDA ACESSO. Só grava a data que faltava — quem decide o
 * corte continua sendo o estado da assinatura. Verificado na mesma auditoria
 * que as 58 também constam como DELAYED na Hotmart, ou seja, nenhum evento de
 * cancelamento foi perdido: elas seguem no fluxo de cobrança deles.
 *
 * Uso:
 *   npx tsx prisma/backfillPastDueDates.ts --dry-run
 *   npx tsx prisma/backfillPastDueDates.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Pausa entre chamadas — a Hotmart limita por frequência. */
const DELAY_MS = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface HotmartSubscriptionItem {
  status?: string;
  date_next_charge?: number | string;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { hotmartRequest } = await import("@/lib/hotmart/client");

  const subs = await prisma.subscription.findMany({
    where: { status: "PAST_DUE", nextChargeAt: null },
    include: {
      hotmart: true,
      user: { select: { email: true } },
    },
  });

  console.log(`PAST_DUE sem nextChargeAt: ${subs.length}`);

  const semCodigo = subs.filter((s) => !s.hotmart?.subscriberCode);
  if (semCodigo.length > 0) {
    console.log(`  sem subscriberCode (não dá para consultar): ${semCodigo.length}`);
  }

  const atualizacoes: { id: string; email: string; data: Date; statusHotmart: string }[] = [];
  const semData: string[] = [];

  for (const s of subs) {
    const code = s.hotmart?.subscriberCode;
    if (!code) continue;

    let item: HotmartSubscriptionItem | undefined;
    try {
      const r = await hotmartRequest<{ items?: HotmartSubscriptionItem[] }>(
        "/payments/api/v1/subscriptions",
        { params: { subscriber_code: code } },
      );
      item = (r.items ?? [])[0];
    } catch (error) {
      console.warn(
        `  ${s.user.email}: falha ao consultar — ${error instanceof Error ? error.message.slice(0, 60) : error}`,
      );
      await sleep(DELAY_MS);
      continue;
    }

    const bruto = item?.date_next_charge;
    if (bruto == null) {
      semData.push(s.user.email);
    } else {
      const data = new Date(typeof bruto === "number" ? bruto : String(bruto));
      if (!isNaN(data.getTime())) {
        atualizacoes.push({
          id: s.id,
          email: s.user.email,
          data,
          statusHotmart: item?.status ?? "—",
        });
      }
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nCom data na Hotmart: ${atualizacoes.length}`);
  for (const a of atualizacoes) {
    console.log(
      `   ${a.email} · próxima cobrança ${a.data.toISOString().slice(0, 10)} · hotmart=${a.statusHotmart}`,
    );
  }
  if (semData.length > 0) {
    console.log(`\nSem date_next_charge na Hotmart: ${semData.length}`);
    for (const e of semData.slice(0, 10)) console.log(`   ${e}`);
  }

  if (dryRun) {
    console.log("\n[dry-run] Nada foi gravado. Rode sem --dry-run para aplicar.");
    return;
  }

  for (const a of atualizacoes) {
    await prisma.subscription.update({
      where: { id: a.id },
      data: { nextChargeAt: a.data },
    });
  }
  console.log(`\n${atualizacoes.length} assinaturas atualizadas.`);
}

main()
  .catch((error) => {
    console.error("Falha no backfill:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
