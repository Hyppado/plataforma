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
import {
  ACHADINHOS_MAX_HASHTAGS,
  ACHADINHOS_HASHTAG_COST_MS,
  SHOPEE_BUDGET,
  parseAchadinhoHashtags,
  serializeAchadinhoHashtags,
} from "@/lib/shopee/types";

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

describe("POST — teto de hashtags", () => {
  beforeEach(() => mockAuthenticatedAdmin());

  /** Gera N IDs numéricos distintos. */
  const ids = (n: number) =>
    Array.from({ length: n }, (_, i) => String(1000000000000000 + i)).join(",");

  it("aceita exatamente o máximo", async () => {
    const req = makePostRequest("/api/admin/settings/shopee", {
      achadinhosHashtagId: ids(ACHADINHOS_MAX_HASHTAGS),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(
      upsertedValue(upsertSetting, "shopee.achadinhos_hashtag_id"),
    ).toBe(ids(ACHADINHOS_MAX_HASHTAGS));
  });

  it("rejeita acima do máximo em vez de cortar em silêncio", async () => {
    // Cortar a lista faria o admin acreditar que salvou hashtags que o
    // pipeline nunca leria. O erro precisa ser visível.
    const req = makePostRequest("/api/admin/settings/shopee", {
      achadinhosHashtagId: ids(ACHADINHOS_MAX_HASHTAGS + 1),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain(String(ACHADINHOS_MAX_HASHTAGS));
    expect(upsertSetting).not.toHaveBeenCalledWith(
      "shopee.achadinhos_hashtag_id",
      expect.anything(),
      expect.anything(),
    );
  });

  it("o teto cabe no orçamento de descoberta", () => {
    // O teto só faz sentido enquanto for derivado do orçamento. Se alguém
    // subir ACHADINHOS_HASHTAG_COST_MS sem rever o orçamento, isto acusa.
    expect(
      ACHADINHOS_MAX_HASHTAGS * ACHADINHOS_HASHTAG_COST_MS,
    ).toBeLessThanOrEqual(SHOPEE_BUDGET.DISCOVERY_BUDGET_MS);
    expect(ACHADINHOS_MAX_HASHTAGS).toBeGreaterThan(1);
  });
});

describe("formato id|nome das hashtags", () => {
  beforeEach(() => mockAuthenticatedAdmin());

  it("grava o nome junto do ID", async () => {
    const req = makePostRequest("/api/admin/settings/shopee", {
      achadinhosHashtagId: "1696392324325382|achadinhosshopee,1697332031215622|achadinhoshopee",
    });
    await POST(req as any);

    expect(upsertedValue(upsertSetting, "shopee.achadinhos_hashtag_id")).toBe(
      "1696392324325382|achadinhosshopee,1697332031215622|achadinhoshopee",
    );
  });

  it("continua aceitando o formato antigo, só com IDs", async () => {
    const req = makePostRequest("/api/admin/settings/shopee", {
      achadinhosHashtagId: "1696392324325382,1697332031215622",
    });
    await POST(req as any);

    expect(upsertedValue(upsertSetting, "shopee.achadinhos_hashtag_id")).toBe(
      "1696392324325382,1697332031215622",
    );
  });

  it("nome com separador não corrompe a lista gravada", async () => {
    // A invariante que importa: o que for gravado tem que reler exatamente
    // os mesmos IDs. Um nome com "," ou "|" não pode inventar nem sumir com
    // uma hashtag — no pior caso o nome trunca, que é cosmético.
    const req = makePostRequest("/api/admin/settings/shopee", {
      achadinhosHashtagId: "1696392324325382|acha,dinhos|shopee,1697332031215622|ok",
    });
    await POST(req as any);

    const gravado = upsertedValue(upsertSetting, "shopee.achadinhos_hashtag_id");
    const relido = parseAchadinhoHashtags(gravado);

    expect(relido.map((h) => h.id)).toEqual([
      "1696392324325382",
      "1697332031215622",
    ]);
    // E o valor gravado é estável: reserializar não muda mais nada.
    expect(serializeAchadinhoHashtags(relido)).toBe(gravado);
  });

  it("GET devolve a seleção já resolvida em {id, name}", async () => {
    // É isto que permite a tela desenhar os chips sem consultar a EchoTik.
    getSetting.mockImplementation(async (k: string) =>
      k === "shopee.achadinhos_hashtag_id"
        ? "1696392324325382|achadinhosshopee,1697332031215622|achadinhoshopee"
        : null,
    );

    const res = await GET();
    const body = await res.json();

    expect(body.achadinhosHashtags).toEqual([
      { id: "1696392324325382", name: "achadinhosshopee" },
      { id: "1697332031215622", name: "achadinhoshopee" },
    ]);
  });
});
