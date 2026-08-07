/**
 * app/api/shopee/achadinhos/[id]/download/route.ts
 *
 * GET /api/shopee/achadinhos/[id]/download
 *
 * Baixa o vídeo do achadinho.
 *
 * POR QUE STREAMAR EM VEZ DE REDIRECIONAR
 * O atributo `download` de um <a> é ignorado em links cross-origin, então
 * redirecionar para o CDN do TikTok abriria o vídeo numa aba em vez de baixar.
 * Passando o arquivo por aqui conseguimos mandar Content-Disposition e um nome
 * de arquivo decente. O corpo é repassado como stream — nada é carregado
 * inteiro em memória.
 *
 * A URL de download da EchoTik é assinada e expira, por isso é resolvida na
 * hora, nunca guardada (mesma lição das capas).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthed } from "@/lib/auth";
import { getVideoDownloadUrl } from "@/lib/transcription/media";
import { buildCanonicalTikTokUrl } from "@/lib/shopee/pipeline";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = createLogger("shopee/download");

/** Nome de arquivo seguro a partir do nome do produto. */
function buildFilename(productName: string | null, videoId: string): string {
  const base = (productName || `achadinho-${videoId}`)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return `${base || videoId}.mp4`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const achadinho = await prisma.shopeeAchadinhoProduct.findUnique({
    where: { id: params.id },
    select: { videoExternalId: true, productName: true, authorName: true, status: true },
  });

  if (!achadinho) {
    return NextResponse.json(
      { ok: false, error: "Achadinho não encontrado" },
      { status: 404 },
    );
  }

  // Usuário final só baixa o que está publicado; admin baixa qualquer um
  // (precisa avaliar antes de aprovar).
  if (achadinho.status !== "READY" && auth.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Achadinho não está disponível" },
      { status: 403 },
    );
  }

  const tiktokUrl = buildCanonicalTikTokUrl(
    achadinho.videoExternalId,
    achadinho.authorName,
  );

  const urls = await getVideoDownloadUrl(achadinho.videoExternalId, tiktokUrl);

  // Preferimos a versão sem marca d'água — é o que o criador quer repostar.
  const source = urls?.noWatermarkUrl || urls?.downloadUrl || urls?.playUrl;

  if (!source) {
    log.info("Sem URL de download disponível", {
      videoExternalId: achadinho.videoExternalId,
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          "Vídeo indisponível para download no momento. A EchoTik não resolveu a URL — tente novamente em alguns minutos.",
      },
      { status: 503 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(source, { signal: AbortSignal.timeout(45_000) });
  } catch (error) {
    log.warn("Falha ao buscar o vídeo no CDN", {
      videoExternalId: achadinho.videoExternalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Não foi possível baixar o vídeo agora." },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { ok: false, error: `CDN respondeu ${upstream.status}` },
      { status: 502 },
    );
  }

  const filename = buildFilename(achadinho.productName, achadinho.videoExternalId);

  // Repassa o corpo como stream — sem bufferizar o arquivo inteiro.
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...(upstream.headers.get("content-length")
        ? { "Content-Length": upstream.headers.get("content-length")! }
        : {}),
      "Cache-Control": "no-store",
    },
  });
}
