/**
 * Reconciliação de acesso — corrige contas com acesso que já deveria ter sido
 * cortado.
 *
 * CONTEXTO
 * Auditoria de 2026-08-10 encontrou duas classes de acesso indevido:
 *
 *  A) PEDIDO DE REEMBOLSO PENDENTE
 *     Cobranças em REFUND_REQUEST cuja assinatura ainda concede acesso. O
 *     PURCHASE_PROTEST não revogava (só marcava a cobrança), então quem pediu
 *     o dinheiro de volta seguiu usando o produto. O processor já foi
 *     corrigido; este script limpa o que ficou para trás.
 *
 *  B) DIVERGÊNCIA COM A HOTMART
 *     Assinaturas ACTIVE/PAST_DUE na nossa base cujo `externalStatus` da
 *     Hotmart já é CANCELED/INACTIVE/EXPIRED. São 30 casos. Causa provável:
 *     PURCHASE_COMPLETE (evento de fim de garantia) sendo tratado como
 *     ativação e ressuscitando assinatura cancelada.
 *
 * O QUE O SCRIPT FAZ
 * Marca a assinatura como CANCELLED e define `endedAt`, respeitando período
 * pago conhecido:
 *
 *   A) endedAt = data do pedido de reembolso (corte imediato, sem período)
 *   B) endedAt = endedAt existente ?? nextChargeAt ?? agora
 *
 * O resolver só concede acesso a CANCELLED enquanto `endedAt > agora`, então
 * quem tem período pago em aberto continua até o fim dele. Quem não tem perde
 * na hora.
 *
 * NÃO MEXE em usuário que tenha OUTRA assinatura vigente — o corte é por
 * assinatura, não por pessoa. Recompra legítima após reembolso é preservada.
 *
 * Toda alteração gera AuditLog com o estado anterior.
 *
 * Uso:
 *   npx tsx prisma/reconcileAccess.ts --dry-run
 *   npx tsx prisma/reconcileAccess.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Status da Hotmart que significam assinatura encerrada do lado deles. */
const EXTERNAL_ENCERRADO = new Set([
  "CANCELED",
  "CANCELLED",
  "INACTIVE",
  "EXPIRED",
  "REFUNDED",
  "CHARGEBACK",
]);

interface Correcao {
  subscriptionId: string;
  userId: string;
  email: string;
  motivo: string;
  statusAntes: string;
  endedAtAntes: Date | null;
  endedAtDepois: Date;
}

async function coletarPedidosDeReembolso(agora: Date): Promise<Correcao[]> {
  const charges = await prisma.subscriptionCharge.findMany({
    where: { status: "REFUND_REQUEST" },
    include: {
      subscription: {
        include: { user: { select: { id: true, email: true } } },
      },
    },
  });

  const saida: Correcao[] = [];
  for (const c of charges) {
    const s = c.subscription;
    // Já sem acesso? Nada a fazer.
    const concedeAcesso =
      s.status === "ACTIVE" ||
      s.status === "PAST_DUE" ||
      (s.status === "CANCELLED" && s.endedAt != null && s.endedAt > agora);
    if (!concedeAcesso) continue;

    saida.push({
      subscriptionId: s.id,
      userId: s.userId,
      email: s.user.email,
      motivo: `pedido de reembolso em ${c.createdAt.toISOString().slice(0, 10)}`,
      statusAntes: s.status,
      endedAtAntes: s.endedAt,
      // Corte imediato: pedido de reembolso não honra período pago.
      endedAtDepois: c.createdAt,
    });
  }
  return saida;
}

async function coletarDivergentes(agora: Date): Promise<Correcao[]> {
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ["ACTIVE", "PAST_DUE"] } },
    include: { hotmart: true, user: { select: { id: true, email: true } } },
  });

  const saida: Correcao[] = [];
  for (const s of subs) {
    const ext = (s.hotmart?.externalStatus ?? "").toUpperCase();
    if (!EXTERNAL_ENCERRADO.has(ext)) continue;

    // Respeita período pago conhecido; sem data, corta agora.
    const endedAtDepois = s.endedAt ?? s.nextChargeAt ?? agora;

    saida.push({
      subscriptionId: s.id,
      userId: s.userId,
      email: s.user.email,
      motivo: `Hotmart marca ${ext}`,
      statusAntes: s.status,
      endedAtAntes: s.endedAt,
      endedAtDepois,
    });
  }
  return saida;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const agora = new Date();

  const pedidos = await coletarPedidosDeReembolso(agora);
  const divergentes = await coletarDivergentes(agora);

  // Uma assinatura pode cair nas duas listas — a de reembolso manda, porque
  // corta imediatamente.
  const porAssinatura = new Map<string, Correcao>();
  for (const c of divergentes) porAssinatura.set(c.subscriptionId, c);
  for (const c of pedidos) porAssinatura.set(c.subscriptionId, c);
  const correcoes = Array.from(porAssinatura.values());

  console.log(`Pedidos de reembolso com acesso ativo: ${pedidos.length}`);
  console.log(`Divergentes com a Hotmart:             ${divergentes.length}`);
  console.log(`Assinaturas a corrigir (sem repetir):  ${correcoes.length}\n`);

  let perdemAgora = 0;
  let mantemAtePeriodo = 0;
  for (const c of correcoes) {
    const perdeAgora = c.endedAtDepois <= agora;
    if (perdeAgora) perdemAgora++;
    else mantemAtePeriodo++;
    console.log(
      `  ${perdeAgora ? "CORTA AGORA " : "até " + c.endedAtDepois.toISOString().slice(0, 10)} · ` +
        `${c.email} · ${c.statusAntes} → CANCELLED · ${c.motivo}`,
    );
  }

  console.log(`\nPerdem acesso imediatamente: ${perdemAgora}`);
  console.log(`Seguem até o fim do período: ${mantemAtePeriodo}`);

  if (dryRun) {
    console.log("\n[dry-run] Nada foi gravado. Rode sem --dry-run para aplicar.");
    return;
  }

  let aplicadas = 0;
  for (const c of correcoes) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: c.subscriptionId },
        data: {
          status: "CANCELLED",
          endedAt: c.endedAtDepois,
          cancelledAt: c.endedAtDepois,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: c.userId,
          actorId: "system",
          action: "ACCESS_RECONCILIATION",
          entityType: "Subscription",
          entityId: c.subscriptionId,
          before: { status: c.statusAntes, endedAt: c.endedAtAntes?.toISOString() ?? null },
          after: {
            status: "CANCELLED",
            endedAt: c.endedAtDepois.toISOString(),
            motivo: c.motivo,
          },
        },
      }),
    ]);
    aplicadas++;
  }

  console.log(`\n${aplicadas} assinaturas reconciliadas.`);
}

main()
  .catch((error) => {
    console.error("Falha na reconciliação:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
