import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const { resolveUserAccess } = await import("@/lib/access/resolver");

  const users = await p.user.findMany({
    select: {
      id: true, email: true, status: true, role: true,
      subscriptions: {
        select: {
          id: true, status: true, endedAt: true, cancelledAt: true, source: true,
          charges: { select: { status: true, createdAt: true, paidAt: true }, orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      accessGrants: { select: { isActive: true, expiresAt: true, startsAt: true, reason: true } },
    },
  });

  const agora = new Date();
  const suspeitos: any[] = [];
  let comAcesso = 0;

  for (const u of users) {
    const acesso = await resolveUserAccess(u.id);
    const tem = acesso.status === "FULL_ACCESS" || acesso.status === "GRACE_PERIOD";
    if (tem) comAcesso++;
    if (!tem) continue;

    // Fatos de cobrança: alguma cobrança reembolsada/chargeback?
    const todasCobrancas = u.subscriptions.flatMap((s) => s.charges);
    const ultima = todasCobrancas[0];
    const temReembolso = todasCobrancas.some((c) => c.status === "REFUNDED" || c.status === "CHARGEBACK");
    const ultimaEhReembolso = ultima && (ultima.status === "REFUNDED" || ultima.status === "CHARGEBACK");

    const motivos: string[] = [];
    if (ultimaEhReembolso) motivos.push(`última cobrança ${ultima.status}`);
    else if (temReembolso) motivos.push("teve reembolso/chargeback no histórico");

    if (motivos.length > 0) {
      suspeitos.push({
        email: u.email, role: u.role, userStatus: u.status,
        acesso: `${acesso.status} via ${acesso.source ?? "?"}`,
        assinaturas: u.subscriptions.map((s) =>
          `${s.status}${s.endedAt ? ` até ${s.endedAt.toISOString().slice(0,10)}` : ""}`).join(", "),
        grantsAtivos: u.accessGrants.filter((g) => g.isActive && (!g.expiresAt || g.expiresAt > agora)).length,
        motivos,
      });
    }
  }

  console.log(`usuários: ${users.length} | com acesso agora: ${comAcesso}`);
  console.log(`\nSUSPEITOS (têm acesso e têm reembolso/chargeback): ${suspeitos.length}\n`);
  for (const s of suspeitos) {
    console.log(`  ${s.email}`);
    console.log(`     acesso=${s.acesso} | user=${s.userStatus} | role=${s.role} | grants ativos=${s.grantsAtivos}`);
    console.log(`     assinaturas: ${s.assinaturas}`);
    console.log(`     motivo: ${s.motivos.join("; ")}`);
  }
  await p.$disconnect();
})();
