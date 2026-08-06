/**
 * Tests: lib/shopee/pipeline.ts — persistência da capa no Blob
 *
 * A EchoTik entrega a capa como URL assinada do CDN do TikTok, com
 * `x-expires`. Guardar essa URL crua faz a capa morrer (403) poucas horas
 * depois — foi o que quebrou 100% dos achadinhos já ingeridos.
 *
 * Estes testes travam as duas correções: baixar para o Blob na ingestão, e
 * atualizar a capa também no caminho de UPDATE (antes só o create gravava).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@tests/helpers/prisma-mock";

vi.mock("@/lib/prisma");

const uploadImageToBlob = vi.fn();
vi.mock("@/lib/storage/blob", () => ({
  uploadImageToBlob: (...a: unknown[]) => uploadImageToBlob(...a),
}));

vi.mock("@/lib/settings", () => ({
  getSecretSetting: vi.fn().mockResolvedValue("sk-test"),
  getSetting: vi.fn().mockResolvedValue(null),
  SETTING_KEYS: { OPENAI_API_KEY: "openai.api_key" },
}));

vi.mock("@/lib/transcription/media", () => ({
  getVideoCaptions: vi.fn().mockResolvedValue({ text: "legenda" }),
  getVideoDownloadUrl: vi.fn().mockResolvedValue(null),
  downloadVideoBuffer: vi.fn().mockResolvedValue(null),
  parseCaptionToPlainText: (r: string) => r,
}));

vi.mock("@/lib/transcription/whisper", () => ({
  transcribeWithWhisper: vi.fn(),
  isWhisperError: () => false,
}));

vi.mock("@/lib/echotik/client", () => ({ fetchVideosByHashtag: vi.fn() }));

vi.mock("@/lib/shopee/shopee-api-client", () => ({
  findBestShopeeOffer: vi.fn().mockResolvedValue(null),
  generateShortLink: vi.fn(),
}));

import { cacheCoverToBlob, processAchadinhoVideo } from "@/lib/shopee/pipeline";

/** URL assinada como a EchoTik devolve — expira. */
const SIGNED_TIKTOK_COVER =
  "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/abc~tplv-tiktokx-origin.image?x-expires=1786000000&x-signature=xyz";
const BLOB_URL =
  "https://abc123.public.blob.vercel-storage.com/shopee/achadinhos/700.jpg";

beforeEach(() => {
  vi.clearAllMocks();
  uploadImageToBlob.mockResolvedValue(BLOB_URL);
});

describe("cacheCoverToBlob", () => {
  it("baixa a URL assinada e devolve a URL permanente do Blob", async () => {
    const result = await cacheCoverToBlob("700", SIGNED_TIKTOK_COVER);

    expect(uploadImageToBlob).toHaveBeenCalledWith(
      SIGNED_TIKTOK_COVER,
      "shopee/achadinhos/700.jpg",
    );
    expect(result).toBe(BLOB_URL);
  });

  it("não regrava uma URL que já é do Blob", async () => {
    const result = await cacheCoverToBlob("700", BLOB_URL);

    expect(uploadImageToBlob).not.toHaveBeenCalled();
    expect(result).toBe(BLOB_URL);
  });

  it("devolve null quando não há capa", async () => {
    expect(await cacheCoverToBlob("700", null)).toBeNull();
    expect(await cacheCoverToBlob("700", undefined)).toBeNull();
    expect(uploadImageToBlob).not.toHaveBeenCalled();
  });

  it("cai para a URL original se o upload falhar", async () => {
    uploadImageToBlob.mockResolvedValue(null);

    const result = await cacheCoverToBlob("700", SIGNED_TIKTOK_COVER);

    expect(result).toBe(SIGNED_TIKTOK_COVER);
  });

  it("não propaga exceção do upload — a capa nunca derruba a ingestão", async () => {
    uploadImageToBlob.mockRejectedValue(new Error("blob down"));

    const result = await cacheCoverToBlob("700", SIGNED_TIKTOK_COVER);

    expect(result).toBe(SIGNED_TIKTOK_COVER);
  });
});

describe("processAchadinhoVideo — gravação da capa", () => {
  const video = {
    video_id: "700",
    video_desc: "achadinho",
    cover_url: SIGNED_TIKTOK_COVER,
    author_name: "creator",
    views: 100_000,
  };

  beforeEach(() => {
    (prismaMock.shopeeAchadinhoProduct.upsert as any).mockResolvedValue({
      id: "rec-700",
    });
    (prismaMock.shopeeAchadinhoProduct.update as any).mockResolvedValue({});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "fone" } }] }),
      }),
    );
  });

  it("grava a URL do Blob, não a URL assinada, no CREATE", async () => {
    await processAchadinhoVideo(video);

    const args = (prismaMock.shopeeAchadinhoProduct.upsert as any).mock.calls[0][0];
    expect(args.create.coverUrl).toBe(BLOB_URL);
    expect(args.create.coverUrl).not.toContain("x-expires");
  });

  it("TAMBÉM atualiza a capa no UPDATE — antes só o create gravava", async () => {
    // Esta era a segunda metade do bug: um registro que nasceu com capa
    // expirada nunca se recuperava, mesmo sendo reprocessado.
    await processAchadinhoVideo(video);

    const args = (prismaMock.shopeeAchadinhoProduct.upsert as any).mock.calls[0][0];
    expect(args.update.coverUrl).toBe(BLOB_URL);
  });

  it("atualiza o título no UPDATE quando há descrição", async () => {
    await processAchadinhoVideo(video);

    const args = (prismaMock.shopeeAchadinhoProduct.upsert as any).mock.calls[0][0];
    expect(args.update.videoTitle).toBe("achadinho");
  });

  it("não sobrescreve capa boa com null quando o vídeo vem sem capa", async () => {
    const semCapa = { ...video, cover_url: undefined };

    await processAchadinhoVideo(semCapa);

    const args = (prismaMock.shopeeAchadinhoProduct.upsert as any).mock.calls[0][0];
    expect(args.update).not.toHaveProperty("coverUrl");
  });
});
