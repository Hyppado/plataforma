/**
 * prisma/seed.ts
 *
 * Seed inicial: cria planos padrão e settings de configuração.
 * Se a API Hotmart estiver disponível, sincroniza offers e cupons.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedRegions() {
  const REGION_NAMES: Record<string, string> = {
    BR: "Brasil",
    US: "United States",
    MX: "México",
    GB: "United Kingdom",
    CA: "Canada",
    AU: "Australia",
    ID: "Indonesia",
    PH: "Philippines",
    TH: "Thailand",
    VN: "Vietnam",
    SG: "Singapore",
    MY: "Malaysia",
    DE: "Germany",
    FR: "France",
    ES: "Spain",
    IT: "Italy",
    UK: "United Kingdom",
  };

  const codes = (process.env.ECHOTIK_REGIONS || "BR")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    await prisma.region.upsert({
      where: { code },
      update: {}, // não sobrescreve se admin já editou
      create: {
        code,
        name: REGION_NAMES[code] ?? code,
        isActive: true,
        sortOrder: i,
      },
    });
  }

  console.log(`✅ Regiões seedadas: [${codes.join(", ")}]`);
}

async function seedSettings() {
  const defaults = [
    {
      key: "hotmart.product_id",
      value: process.env.HOTMART_PRODUCT_ID ?? "",
      label: "ID do Produto Hotmart",
      group: "hotmart",
      type: "text",
    },
    {
      key: "hotmart.webhook_url",
      value: "",
      label: "URL do Webhook (informativo)",
      group: "hotmart",
      type: "text",
    },
    {
      key: "app.name",
      value: "Hyppado",
      label: "Nome da Aplicação",
      group: "general",
      type: "text",
    },
  ];

  for (const s of defaults) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {}, // não sobrescreve se já existir
      create: s,
    });
  }

  console.log("✅ Settings base criados.");
}

async function seedPlans() {
  const plans = [
    {
      code: "pro_mensal",
      name: "Pro",
      description:
        "Plano Pro mensal com acesso completo às ferramentas Hyppado.",
      displayPrice: "R$ 59,90",
      priceAmount: 5990,
      periodicity: "MONTHLY" as const,
      sortOrder: 1,
      highlight: false,
      features: [
        "40 transcripts / mês",
        "70 insights / mês",
        "Descoberta de vídeos e produtos em alta",
        "Prompts avançados (gancho, roteiro e CTA)",
        "Organização por categorias",
      ],
      transcriptsPerMonth: 40,
      scriptsPerMonth: 70,
      insightTokensMonthlyMax: 50000,
      scriptTokensMonthlyMax: 20000,
      insightMaxOutputTokens: 800,
      scriptMaxOutputTokens: 1500,
    },
    {
      code: "premium_anual",
      name: "Premium",
      description:
        "Plano Premium anual com todos os recursos e suporte prioritário.",
      displayPrice: "R$ 647,00",
      priceAmount: 64700,
      periodicity: "ANNUAL" as const,
      sortOrder: 2,
      highlight: true,
      badge: "Mais escolhido",
      features: [
        "Tudo do Pro incluso",
        "Economia de 10% vs mensal",
        "Acesso prioritário a novidades",
        "Suporte prioritário",
      ],
      transcriptsPerMonth: 40,
      scriptsPerMonth: 70,
      insightTokensMonthlyMax: 50000,
      scriptTokensMonthlyMax: 20000,
      insightMaxOutputTokens: 800,
      scriptMaxOutputTokens: 1500,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {}, // não sobrescreve se admin já editou
      create: plan,
    });
  }

  console.log("✅ Planos base criados.");
}

async function main() {
  console.log("🌱 Iniciando seed...\n");

  await seedSettings();
  await seedPlans();
  await seedRegions();

  // Tenta sincronizar dados reais via API Hotmart
  const hasApiCreds =
    process.env.HOTMART_CLIENTE_ID &&
    process.env.HOTMART_CLIENT_SECRET &&
    process.env.HOTMART_BASIC;

  if (!hasApiCreds) {
    console.warn("⚠️  Credenciais Hotmart ausentes — pulando sync da API.");
    console.log("\n🎉 Seed básico concluído.");
    return;
  }

  // Lê productId do banco (que acabou de ser seedado)
  const productIdSetting = await prisma.setting.findUnique({
    where: { key: "hotmart.product_id" },
  });
  const productId = productIdSetting?.value;

  if (!productId) {
    console.warn("⚠️  Product ID não configurado — pulando sync.");
    console.log("\n🎉 Seed básico concluído.");
    return;
  }

  console.log("🔄 Sincronizando dados da API Hotmart...");
  const { syncAll } = await import("../lib/hotmart/sync");
  const { offers, coupons } = await syncAll(productId);

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
