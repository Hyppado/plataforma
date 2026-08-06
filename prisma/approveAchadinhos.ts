/**
 * Script de aprovação em massa — "Achadinhos Shopee".
 *
 * CONTEXTO
 * O gate de aprovação (PENDING -> READY) passou a valer: o feed público mostra
 * apenas achadinhos com status READY.
 *
 * NOTA: o acervo anterior ao gate já é publicado automaticamente pela migração
 * 20260806120000_shopee_achadinho_status_enum, na mesma transação do cast —
 * então NÃO existe janela de feed vazio e este script normalmente não precisa
 * ser executado.
 *
 * Ele permanece como ferramenta operacional para casos pontuais: publicar em
 * lote uma fila de revisão que cresceu demais, ou reprocessar um ambiente que
 * ficou para trás. O uso normal de aprovação é o painel admin.
 *
 * Uso:
 *   npx tsx prisma/approveAchadinhos.ts --dry-run   # mostra o que faria
 *   npx tsx prisma/approveAchadinhos.ts             # aplica
 *
 * Comportamento:
 *   - Aprova apenas PENDING com produto E link de afiliado preenchidos
 *     (um achadinho sem produto não tem o que publicar)
 *   - Nunca toca em PROCESSING, FAILED ou REJECTED
 *   - --dry-run não escreve nada
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Só publica o que está de fato utilizável: precisa de produto e link.
  const where = {
    status: "PENDING",
    productName: { not: null },
    affiliateLink: { not: null },
  } as const;

  const [eligible, totalPending] = await Promise.all([
    prisma.shopeeAchadinhoProduct.count({ where }),
    prisma.shopeeAchadinhoProduct.count({ where: { status: "PENDING" } }),
  ]);

  const skipped = totalPending - eligible;

  console.log(`Achadinhos PENDING no banco: ${totalPending}`);
  console.log(`  elegíveis (com produto + link): ${eligible}`);
  console.log(`  ignorados (sem produto ou link): ${skipped}`);

  if (eligible === 0) {
    console.log("\nNada a aprovar.");
    return;
  }

  if (dryRun) {
    console.log(`\n[dry-run] ${eligible} registros seriam movidos para READY.`);
    console.log("Rode sem --dry-run para aplicar.");
    return;
  }

  const { count } = await prisma.shopeeAchadinhoProduct.updateMany({
    where,
    data: { status: "READY" },
  });

  console.log(`\n${count} achadinhos publicados (PENDING -> READY).`);
  if (skipped > 0) {
    console.log(
      `${skipped} continuam em PENDING por não terem produto/link — revise no painel admin.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Falha ao aprovar achadinhos:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
