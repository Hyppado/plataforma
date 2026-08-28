/**
 * app/api/admin/settings/maintenance-banner/route.ts
 *
 * GET  — estado atual da faixa de aviso (para o painel admin)
 * POST — liga/desliga e atualiza a mensagem
 *
 * A mensagem é guardada mesmo com o aviso desligado, para que o admin possa
 * deixá-la pronta e só acionar quando precisar.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthed } from "@/lib/auth";
import {
  getSetting,
  upsertSetting,
  SETTING_KEYS,
  MAINTENANCE_BANNER_DEFAULT_MESSAGE,
} from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Limite da mensagem: é uma faixa fina, não um comunicado. */
const MAX_MENSAGEM = 280;

export async function GET() {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  const [enabled, message] = await Promise.all([
    getSetting(SETTING_KEYS.MAINTENANCE_BANNER_ENABLED),
    getSetting(SETTING_KEYS.MAINTENANCE_BANNER_MESSAGE),
  ]);

  return NextResponse.json({
    enabled: enabled === "true",
    message: message ?? "",
    defaultMessage: MAINTENANCE_BANNER_DEFAULT_MESSAGE,
    maxLength: MAX_MENSAGEM,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!isAuthed(auth)) return auth;

  let body: { enabled?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled deve ser booleano" },
      { status: 400 },
    );
  }

  const mensagem = typeof body.message === "string" ? body.message.trim() : "";
  if (mensagem.length > MAX_MENSAGEM) {
    return NextResponse.json(
      { error: `A mensagem deve ter no máximo ${MAX_MENSAGEM} caracteres` },
      { status: 400 },
    );
  }

  // Ligar sem mensagem exibiria a faixa vazia. Recusar seria pior — o admin
  // pode estar com pressa numa queda —, então cai no texto padrão.
  const mensagemFinal =
    body.enabled && !mensagem ? MAINTENANCE_BANNER_DEFAULT_MESSAGE : mensagem;

  await Promise.all([
    upsertSetting(
      SETTING_KEYS.MAINTENANCE_BANNER_ENABLED,
      String(body.enabled),
      { label: "Aviso de indisponibilidade ativo", group: "maintenance", type: "boolean" },
    ),
    upsertSetting(SETTING_KEYS.MAINTENANCE_BANNER_MESSAGE, mensagemFinal, {
      label: "Mensagem do aviso",
      group: "maintenance",
      type: "text",
    }),
  ]);

  // Ligar ou desligar o aviso é ação de operação com efeito para todos os
  // usuários — fica registrado com quem fez e o texto exibido.
  await prisma.auditLog.create({
    data: {
      actorId: auth.userId,
      action: body.enabled
        ? "MAINTENANCE_BANNER_ENABLED"
        : "MAINTENANCE_BANNER_DISABLED",
      entityType: "Setting",
      entityId: SETTING_KEYS.MAINTENANCE_BANNER_ENABLED,
      after: { enabled: body.enabled, message: mensagemFinal },
    },
  });

  return NextResponse.json({ enabled: body.enabled, message: mensagemFinal });
}
