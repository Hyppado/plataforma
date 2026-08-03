/**
 * Script de limpeza do banco de dados — "Achadinhos Shopee".
 *
 * Remove os achadinhos com menos de 30.000 views (vindos do TikTok/EchoTik)
 * que passaram antes da implementação do filtro de relevância, ou que tenham
 * viewCount inválido/zerado (NaN, string lixo, etc.).
 *
 * Uso:
 *   npx tsx prisma/cleanupAchadinhos.ts
 *
 * Comportamento:
 *   - Deleta registros ShopeeAchadinhoProduct com views < 30.000
 *   - Imprime quantos foram removidos
 *   - Não apaga nada se não houver registros a remover
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Deve estar em sincronia com MIN_VIEWS_THRESHOLD do pipeline
const MIN_VIEWS_THRESHOLD = 30_000;

async function main() {
  console.log(
    `🧹 Limpando achadinhos com menos de ${MIN_VIEWS_THRESHOLD} views...`,
  );

  const deleted = await prisma.shopeeAchadinhoProduct.deleteMany({
    where: {
      views: { lt: MIN_VIEWS_THRESHOLD },
    },
  });

  console.log(`✅ Removidos ${deleted.count} achadinhos com views < ${MIN_VIEWS_THRESHOLD}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});