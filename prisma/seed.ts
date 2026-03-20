import { PrismaClient, PlanCode, PlanPeriod } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding plans...");

  // PRO MENSAL — R$ 59,90/mês
  const pro = await prisma.plan.upsert({
    where: { code: PlanCode.PRO_MENSAL },
    update: {
      hotmartProductId: "7420891",
      // hotmartPlanCode: "NOME_DO_PLANO_NO_HOTMART",   // preencher após verificar no painel
      // hotmartOfferCode: "OFFER_CODE_MENSAL",          // preencher após verificar no painel
    },
    create: {
      code: PlanCode.PRO_MENSAL,
      name: "Pro",
      description:
        "Plano Pro mensal com acesso completo às ferramentas Hyppado.",
      priceAmount: 5990,
      currency: "BRL",
      periodicity: PlanPeriod.MONTHLY,
      isActive: true,
      hotmartProductId: "7420891",
      // hotmartPlanCode: "NOME_DO_PLANO_NO_HOTMART",
      // hotmartOfferCode: "OFFER_CODE_MENSAL",
    },
  });
  console.log(`✅ Plan PRO_MENSAL: ${pro.id}`);

  // PREMIUM ANUAL — R$ 647/ano
  const premium = await prisma.plan.upsert({
    where: { code: PlanCode.PREMIUM_ANUAL },
    update: {
      hotmartProductId: "7420891",
      // hotmartPlanCode: "NOME_DO_PLANO_ANUAL_NO_HOTMART",
      // hotmartOfferCode: "OFFER_CODE_ANUAL",
    },
    create: {
      code: PlanCode.PREMIUM_ANUAL,
      name: "Premium",
      description:
        "Plano Premium anual com todos os recursos e suporte prioritário.",
      priceAmount: 64700,
      currency: "BRL",
      periodicity: PlanPeriod.ANNUAL,
      isActive: true,
      hotmartProductId: "7420891",
      // hotmartPlanCode: "NOME_DO_PLANO_ANUAL_NO_HOTMART",
      // hotmartOfferCode: "OFFER_CODE_ANUAL",
    },
  });
  console.log(`✅ Plan PREMIUM_ANUAL: ${premium.id}`);

  console.log("🎉 Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
