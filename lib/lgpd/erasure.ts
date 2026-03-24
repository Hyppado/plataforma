/**
 * lib/lgpd/erasure.ts
 *
 * Processamento de solicitações de exclusão de dados (LGPD Art. 18, V).
 *
 * Fluxo:
 *   1. Usuário solicita exclusão → DataErasureRequest(PENDING)
 *   2. Admin analisa e aprova → processErasure()
 *   3. Dados pessoais anonimizados, conteúdo do usuário deletado
 *   4. User.status → INACTIVE, User.deletedAt → now()
 *   5. Registros fiscais/legais mantidos com referência anonimizada
 */

import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Request creation
// ---------------------------------------------------------------------------

/**
 * Cria uma solicitação de exclusão de dados.
 */
export async function createErasureRequest(userId: string): Promise<string> {
  const existing = await prisma.dataErasureRequest.findFirst({
    where: { userId, status: { in: ["PENDING", "IN_PROGRESS"] } },
  });

  if (existing) {
    return existing.id; // Já existe pedido pendente
  }

  const request = await prisma.dataErasureRequest.create({
    data: { userId },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      actorId: userId,
      action: "DATA_ERASURE_REQUESTED",
      entityType: "DataErasureRequest",
      entityId: request.id,
    },
  });

  return request.id;
}

// ---------------------------------------------------------------------------
// Erasure processing
// ---------------------------------------------------------------------------

/**
 * Processa a exclusão de dados pessoais de um usuário.
 *
 * Dados anonimizados:
 *   - User: email → "deleted_XXX@anon.hyppado", name → null, passwordHash → null
 *   - HotmartIdentity: buyerEmail → null
 *
 * Dados deletados:
 *   - SavedItem, CollectionItem, Collection, Note, Alert
 *
 * Dados mantidos (com referência anonimizada):
 *   - AuditLog (obrigação legal / segurança — 5 anos)
 *   - SubscriptionCharge (obrigação fiscal — 5 anos)
 *   - Subscription (referência comercial)
 *   - ConsentRecord (comprovação de consentimento — permanente)
 *   - UsagePeriod / UsageEvent
 */
export async function processErasure(
  requestId: string,
  adminId: string,
): Promise<{ success: boolean; anonymizedFields: string[] }> {
  const request = await prisma.dataErasureRequest.findUnique({
    where: { id: requestId },
    include: { user: true },
  });

  if (!request || request.status !== "PENDING") {
    return { success: false, anonymizedFields: [] };
  }

  const { userId } = request;
  const anonymizedFields: string[] = [];
  const anonSuffix = randomBytes(8).toString("hex");
  const anonEmail = `deleted_${anonSuffix}@anon.hyppado`;

  // Mark as in-progress
  await prisma.dataErasureRequest.update({
    where: { id: requestId },
    data: { status: "IN_PROGRESS" },
  });

  try {
    // 1. Cancel any active subscriptions first
    await prisma.subscription.updateMany({
      where: { userId, status: { in: ["ACTIVE", "PAST_DUE", "PENDING"] } },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    // 2. Revoke any active access grants
    await prisma.accessGrant.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, revokedAt: new Date(), revokedBy: adminId },
    });

    // 3. Delete user content
    await prisma.alert.deleteMany({ where: { userId } });
    anonymizedFields.push("alerts");

    // Delete collection items through collections first
    const collections = await prisma.collection.findMany({
      where: { userId },
      select: { id: true },
    });
    if (collections.length > 0) {
      await prisma.collectionItem.deleteMany({
        where: { collectionId: { in: collections.map((c) => c.id) } },
      });
    }
    await prisma.collection.deleteMany({ where: { userId } });
    anonymizedFields.push("collections", "collectionItems");

    await prisma.savedItem.deleteMany({ where: { userId } });
    anonymizedFields.push("savedItems");

    await prisma.note.deleteMany({ where: { userId } });
    anonymizedFields.push("notes");

    // 4. Anonymize HotmartIdentity
    const identity = await prisma.hotmartIdentity.findUnique({
      where: { userId },
    });
    if (identity) {
      await prisma.hotmartIdentity.update({
        where: { id: identity.id },
        data: { buyerEmail: null },
      });
      anonymizedFields.push("hotmartIdentity.buyerEmail");
    }

    // 5. Delete usage events (non-fiscal)
    await prisma.usageEvent.deleteMany({ where: { userId } });
    await prisma.usagePeriod.deleteMany({ where: { userId } });
    anonymizedFields.push("usageEvents", "usagePeriods");

    // 6. Anonymize User
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: anonEmail,
        name: null,
        passwordHash: null,
        status: "INACTIVE",
        deletedAt: new Date(),
        lgpdConsentAt: null,
        lgpdConsentVersion: null,
      },
    });
    anonymizedFields.push("user.email", "user.name", "user.passwordHash");

    // 7. Mark request as completed
    await prisma.dataErasureRequest.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
        processedBy: adminId,
        anonymizedFields: anonymizedFields,
      },
    });

    // 8. Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        actorId: adminId,
        action: "DATA_ERASURE_COMPLETED",
        entityType: "DataErasureRequest",
        entityId: requestId,
        after: { anonymizedFields, anonEmail },
      },
    });

    return { success: true, anonymizedFields };
  } catch (err) {
    // Rollback status on error
    await prisma.dataErasureRequest.update({
      where: { id: requestId },
      data: {
        status: "PENDING",
        notes: `Erro no processamento: ${err instanceof Error ? err.message : String(err)}`,
      },
    });

    throw err;
  }
}

/**
 * Rejeita uma solicitação de exclusão (ex: obrigação legal impede).
 */
export async function rejectErasure(
  requestId: string,
  adminId: string,
  reason: string,
): Promise<void> {
  await prisma.dataErasureRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      processedAt: new Date(),
      processedBy: adminId,
      notes: reason,
    },
  });

  const request = await prisma.dataErasureRequest.findUnique({
    where: { id: requestId },
  });

  await prisma.auditLog.create({
    data: {
      userId: request?.userId,
      actorId: adminId,
      action: "DATA_ERASURE_REJECTED",
      entityType: "DataErasureRequest",
      entityId: requestId,
      after: { reason },
    },
  });
}
