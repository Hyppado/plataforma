/**
 * prisma/seed.ts
 *
 * Seed inicial: sincroniza planos e cupons do produto Hotmart 7420891.
 * Se a API não responder (credenciais ausentes), faz upsert mínimo hardcoded.
 */

import { PrismaClient, PlanCode, PlanPeriod } from "@prisma/client";
import { syncAll } from "../lib/hotmart/sync";

const prisma = new PrismaClient();

const PRODUCT_ID = "7420891";

async function baseline() {
  // Garante que os planos existam mesmo sem API Hotmart disponível
  await prisma.plan.upsert({
    where: { code: PlanCode.PRO_MENSAL },
    update: {},
    create: {
      code: PlanCode.PRO_MENSAL,
      name: "Pro",
      description:
        "Plano Pro mensal com acesso completo às ferramentas Hyppado.",
      priceAmount: 5990,
      currency: "BRL",
      periodicity: PlanPeriod.MONTHLY,
      isActive: true,
      hotmartProductId: PRODUCT_ID,
    },
  });

  await prisma.plan.upsert({
    where: { code: PlanCode.PREMIUM_ANUAL },
    update: {},
    create: {
      code: PlanCode.PREMIUM_ANUAL,
      name: "Premium",
      description:
        "Plano Premium anual com todos os recursos e suporte prioritário.",
      priceAmount: 64700,
      currency: "BRL",
      periodicity: PlanPeriod.ANNUAL,
      isActive: true,
      hotmartProductId: PRODUCT_ID,
    },
  });

  console.log("✅ Planos base garantidos no banco.");
}

async function main() {
  console.log("🌱 Iniciando seed...\n");

  // 1. Garante planos base (sem depender da API Hotmart)
  await baseline();

  // 2. Tenta sincronizar dados reais via API Hotmart
  const hasApiCreds =
    process.env.HOTMART_CLIENTE_ID &&
    process.env.HOTMART_CLIENT_SECRET &&
    process.env.HOTMART_BASIC;

  if (!hasApiCreds) {
    console.warn("⚠️  Credenciais Hotmart ausentes — pulando sync da API.");
    console.log("\n🎉 Seed básico concluído.");
    return;
  }

  console.log("🔄 Sincronizando dados da API Hotmart...");
  const { offers, coupons } = await syncAll(PRODUCT_ID);

  console.log(
    `\n✅ Offers sincronizados: [${offers.upserted.join(", ") || "nenhum"}]`,
  );
  if (offers.skipped.length)
    console.log(`   Pulados (não-assinatura): [${offers.skipped.join(", ")}]`);

  console.log(
    `✅ Cupons sincronizados: [${coupons.upserted.join(", ") || "nenhum"}]`,
  );
  if (coupons.deactivated.length)
    console.log(`   Desativados: ${coupons.deactivated.join(", ")}`);

  console.log("\n🎉 Seed completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
