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
    JP: "Japan",
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
  };

  // All supported regions — the admin can toggle isActive via the admin panel.
  // Do NOT use env vars; the DB is the single source of truth for regions.
  const DEFAULT_ACTIVE = new Set(["BR", "US", "JP"]);
  const ALL_CODES = Object.keys(REGION_NAMES);

  for (let i = 0; i < ALL_CODES.length; i++) {
    const code = ALL_CODES[i];
    await prisma.region.upsert({
      where: { code },
      update: {}, // nunca sobrescreve se admin já editou o banco
      create: {
        code,
        name: REGION_NAMES[code] ?? code,
        isActive: DEFAULT_ACTIVE.has(code),
        sortOrder: i,
      },
    });
  }

  console.log(
    `✅ Regiões seedadas: ${ALL_CODES.length} total (${Array.from(DEFAULT_ACTIVE).join(", ")} ativas)`,
  );
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

  console.log("\n🎉 Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
