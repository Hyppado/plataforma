/**
 * Tests: app/api/admin/settings/shopee/route.ts
 *
 * Fronteira de segurança: guarda de ADMIN e manipulação das credenciais da
 * Shopee Affiliate. O ponto mais importante é que o GET NUNCA devolva os
 * segredos — apenas se estão configurados.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockAuthenticatedUser,
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  makePostRequest,
} from "@tests/helpers/auth";

const getSetting = vi.fn();
const hasSecretSetting = vi.fn();
const upsertSetting = vi.fn();
const upsertSecretSetting = vi.fn();

vi.mock("@/lib/settings", () => ({
  getSetting: (...a: unknown[]) => getSetting(...a),
  hasSecretSetting: (...a: unknown[]) => hasSecretSetting(...a),
  upsertSetting: (...a: unknown[]) => upsertSetting(...a),
  upsertSecretSetting: (...a: unknown[]) => upsertSecretSetting(...a),
  SETTING_KEYS: {
    SHOPEE_AFFILIATE_APP_ID: "shopee.affiliate_app_id",
    SHOPEE_AFFILIATE_API_SECRET: "shopee.affiliate_api_secret",
    SHOPEE_RANKING_LIMIT: "shopee.ranking_limit",
    SHOPEE_RANKING_FREQUENCY: "shopee.ranking_frequency",
    SHOPEE_ACHADINHOS_FREQUENCY: "shopee.achadinhos_frequency",
    SHOPEE_ACHADINHOS_COUNT: "shopee.achadinhos_count",
    SHOPEE_ACHADINHOS_HASHTAG_ID: "shopee.achadinhos_hashtag_id",
  },
}));

import { GET, POST } from "@/app/api/admin/settings/shopee/route";

/** Extrai o valor gravado para uma chave de Setting. */
function upsertedValue(mock: typeof upsertSetting, key: string) {
  const call = mock.mock.calls.find((c) => c[0] === key);
  return call?.[1];
}

beforeEach(() => {
  vi.clearAllMocks();
  getSetting.mockResolvedValue(null);
  hasSecretSetting.mockResolvedValue(false);
  upsertSetting.mockResolvedValue({});
  upsertSecretSetting.mockResolvedValue({});
});

describe("GET — guarda de admin", () => {
  it("rejeita não autenticado", async () => {
    mockUnauthenticated();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("rejeita usuário comum", async () => {
    mockAuthenticatedUser();
    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe("GET — não vaza segredos", () => {
  beforeEach(() => mockAuthenticatedAdmin());

  it("devolve apenas o booleano configured, nunca os valores", async () => {
    hasSecretSetting.mockResolvedValue(true);

    const res = await GET();
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(body.configured).toBe(true);
    // Nenhum campo de credencial no payload
    expect(body).not.toHaveProperty("affiliateAppId");
    expect(body).not.toHaveProperty("affiliateSecret");
    expect(serialized).not.toMatch(/secret/i);
  });

  it("configured=false quando falta alguma credencial", async () => {
    hasSecretSetting.mockImplementation(async (key: string) =>
      key === "shopee.affiliate_app_id",
    );

    const body = await (await GET()).json();
    expect(body.configured).toBe(false);
  });

  it("devolve os defaults documentados quando nada foi salvo", async () => {
    const body = await (await GET()).json();

    expect(body).toMatchObject({
      rankingLimit: "50",
      rankingFrequency: "24",
      achadinhosFrequency: "12",
      achadinhosCount: "50",
      achadinhosHashtagId: "1696392324325382",
    });
  });
});

describe("POST — guarda de admin", () => {
  it("rejeita não autenticado", async () => {
    mockUnauthenticated();
    const req = makePostRequest("/api/admin/settings/shopee", {
      affiliateAppId: "x",
    });
    const res = await POST(req as any);

    expect(res.status).toBe(401);
    expect(upsertSecretSetting).not.toHaveBeenCalled();
  });

  it("rejeita usuário comum", async () => {
    mockAuthenticatedUser();
    const req = makePostRequest("/api/admin/settings/shopee", {
      affiliateAppId: "x",
    });
    const res = await POST(req as any);

    expect(res.status).toBe(403);
    expect(upsertSecretSetting).not.toHaveBeenCalled();
  });
});

describe("POST — credenciais", () => {
  beforeEach(() => mockAuthenticatedAdmin());

  it("grava credenciais pelo caminho de segredo (criptografado)", async () => {
    const req = makePostRequest("/api/admin/settings/shopee", {
      affiliateAppId: "app-123",
      affiliateSecret: "sec-456",
    });
    await POST(req as any);

    expect(upsertSecretSetting).toHaveBeenCalledWith(
      "shopee.affiliate_app_id",
      "app-123",
      expect.anything(),
    );
    expect(upsertSecretSetting).toHaveBeenCalledWith(
      "shopee.affiliate_api_secret",
      "sec-456",
      expect.anything(),
    );
    // Credenciais nunca podem cair no caminho de setting em texto claro
    expect(upsertSetting).not.toHaveBeenCalledWith(
      "shopee.affiliate_api_secret",
      expect.anything(),
      expect.anything(),
    );
  });

  it("ignora credenciais em branco em vez de apagar as existentes", async () => {
    const req = makePostRequest("/api/admin/settings/shopee", {
      affiliateAppId: "   ",
      affiliateSecret: "",
    });
    await POST(req as any);

    expect(upsertSecretSetting).not.toHaveBeenCalled();
  });

  it("ignora tipos não-string", async () => {
    const req = makePostRequest("/api/admin/settings/shopee", {
      affiliateAppId: 12345,
      affiliateSecret: { evil: true },
    });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(upsertSecretSetting).not.toHaveBeenCalled();
  });
});

describe("POST — parâmetros de sincronização", () => {
  beforeEach(() => mockAuthenticatedAdmin());

  it("limita achadinhosCount ao teto de 400", async () => {
    const req = makePostRequest("/api/admin/settings/shopee", {
      achadinhosCount: "9999",
    });
    await POST(req as any);

    expect(upsertedValue(upsertSetting, "shopee.achadinhos_count")).toBe("400");
  });

  it("limita achadinhosCount ao piso de 20", async () => {
    const req = makePostRequest("/api/admin/settings/shopee", {
      achadinhosCount: "1",
    });
    await POST(req as any);

    expect(upsertedValue(upsertSetting, "shopee.achadinhos_count")).toBe("20");
  });

  it("descarta achadinhosCount não numérico", async () => {
    const req = makePostRequest("/api/admin/settings/shopee", {
      achadinhosCount: "abc",
    });
    await POST(req as any);

    expect(upsertedValue(upsertSetting, "shopee.achadinhos_count")).toBeUndefined();
  });

  it("grava apenas os campos enviados", async () => {
    const req = makePostRequest("/api/admin/settings/shopee", {
      rankingLimit: "30",
    });
    await POST(req as any);

    expect(upsertedValue(upsertSetting, "shopee.ranking_limit")).toBe("30");
    expect(
      upsertedValue(upsertSetting, "shopee.ranking_frequency"),
    ).toBeUndefined();
  });

  it("aceita corpo vazio sem gravar nada", async () => {
    const req = makePostRequest("/api/admin/settings/shopee", {});
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(upsertSetting).not.toHaveBeenCalled();
    expect(upsertSecretSetting).not.toHaveBeenCalled();
  });
});
