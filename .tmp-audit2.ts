import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const { resolveUserAccess } = await import("@/lib/access/resolver");
  const agora = new Date();

  const users = await p.user.findMany({
    select: {
      id: true, email: true, status: true, role: true,
      subscriptions: {
        select: { status: true, source: true, endedAt: true, startedAt: true, createdAt: true, updatedAt: true,
                  charges: { select: { status: true, createdAt: true }, orderBy: { createdAt: "desc" } } },
      },
      accessGrants: { select: { isActive: true, startsAt: true, expiresAt: true, reason: true } },
    },
  });

  const buckets: Record<string, any[]> = {
    "ACTIVE sem NENHUMA cobrança paga": [],
    "ACTIVE com última cobrança não-paga": [],
    "PAST_DUE há mais de 30 dias": [],
    "Acesso só por grant sem validade (perpétuo)": [],
  };
  const porFonte: Record<string, number> = {};

  for (const u of users) {
    const a = await resolveUserAccess(u.id);
    const tem = a.status === "FULL_ACCESS" || a.status === "GRACE_PERIOD";
    if (!tem) continue;
    porFonte[a.source ?? "?"] = (porFonte[a.source ?? "?"] ?? 0) + 1;

    const ativa = u.subscriptions.find((s) => s.status === "ACTIVE");
    if (ativa) {
      const pagas = ativa.charges.filter((c) => c.status === "PAID");
      if (pagas.length === 0) {
        buckets["ACTIVE sem NENHUMA cobrança paga"].push(
          `${u.email} (${ativa.source}, ${ativa.charges.length} cobranças: ${ativa.charges.map(c=>c.status).join(",") || "nenhuma"})`);
      } else if (ativa.charges[0] && ativa.charges[0].status !== "PAID") {
        buckets["ACTIVE com última cobrança não-paga"].push(
          `${u.email} — última: ${ativa.charges[0].status} em ${ativa.charges[0].createdAt.toISOString().slice(0,10)}`);
      }
    }

    const pastDue = u.subscriptions.find((s) => s.status === "PAST_DUE");
    if (a.status === "GRACE_PERIOD" && pastDue) {
      const dias = (agora.getTime() - pastDue.updatedAt.getTime()) / 864e5;
      if (dias > 30) buckets["PAST_DUE há mais de 30 dias"].push(`${u.email} — há ${dias.toFixed(0)} dias`);
    }

    if (a.source === "manual_grant") {
      const g = u.accessGrants.find((x) => x.isActive && (!x.expiresAt || x.expiresAt > agora));
      if (g && !g.expiresAt) buckets["Acesso só por grant sem validade (perpétuo)"].push(`${u.email} — "${g.reason}"`);
    }
  }

  console.log("acesso por fonte:");
  for (const [k, v] of Object.entries(porFonte)) console.log(`  ${k}: ${v}`);
  for (const [nome, lista] of Object.entries(buckets)) {
    console.log(`\n${nome}: ${lista.length}`);
    for (const l of lista.slice(0, 15)) console.log(`   ${l}`);
    if (lista.length > 15) console.log(`   ... e mais ${lista.length - 15}`);
  }
  await p.$disconnect();
})();
