/**
 * Tests: app/api/admin/settings/shopee/hashtags/route.ts
 *
 * O seletor de hashtag existe para impedir que o admin digite um ID que não
 * existe — erro que só apareceria horas depois, como um cron sem resultados.
 * Estes testes travam a guarda de admin e a degradação quando a EchoTik cai.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockAuthenticatedUser,
  mockAuthenticatedAdmin,
  mockUnauthenticated,
  makeGetRequest,
} from "@tests/helpers/auth";

const searchHashtags = vi.fn();
vi.mock("@/lib/echotik/client", () => ({
  searchHashtags: (...a: unknown[]) => searchHashtags(...a),
}));

import { GET } from "@/app/api/admin/settings/shopee/hashtags/route";

const RESULTADO = [
  { id: "1696392324325382", name: "achadinhosshopee", videoCount: 599255, viewCount: 1e10 },
  { id: "1697332031215622", name: "achadinhoshopee", videoCount: 47641, viewCount: 1e9 },
];

beforeEach(() => {
  vi.clearAllMocks();
  searchHashtags.mockResolvedValue(RESULTADO);
});

describe("guarda de admin", () => {
  it("rejeita não autenticado", async () => {
    mockUnauthenticated();
    const res = await GET(makeGetRequest("/api/admin/settings/shopee/hashtags") as any);
    expect(res.status).toBe(401);
    expect(searchHashtags).not.toHaveBeenCalled();
  });

  it("rejeita usuário comum", async () => {
    mockAuthenticatedUser();
    const res = await GET(makeGetRequest("/api/admin/settings/shopee/hashtags") as any);
    expect(res.status).toBe(403);
    expect(searchHashtags).not.toHaveBeenCalled();
  });
});

describe("busca", () => {
  beforeEach(() => mockAuthenticatedAdmin());

  it("devolve as hashtags encontradas", async () => {
    const res = await GET(
      makeGetRequest("/api/admin/settings/shopee/hashtags", { q: "achadinhos" }) as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hashtags).toHaveLength(2);
    expect(body.hashtags[0].id).toBe("1696392324325382");
  });

  it("usa o termo padrão quando q não vem", async () => {
    await GET(makeGetRequest("/api/admin/settings/shopee/hashtags") as any);

    expect(searchHashtags).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: "achadinhosshopee" }),
    );
  });

  it("não chama a API para termos curtos demais", async () => {
    const res = await GET(
      makeGetRequest("/api/admin/settings/shopee/hashtags", { q: "a" }) as any,
    );
    const body = await res.json();

    expect(body.hashtags).toEqual([]);
    expect(searchHashtags).not.toHaveBeenCalled();
  });

  it("repassa a região", async () => {
    await GET(
      makeGetRequest("/api/admin/settings/shopee/hashtags", {
        q: "shopee",
        region: "US",
      }) as any,
    );

    expect(searchHashtags).toHaveBeenCalledWith(
      expect.objectContaining({ region: "US" }),
    );
  });

  it("degrada para 502 com lista vazia quando a EchoTik falha", async () => {
    // Risk control é comum; a tela de configuração não pode quebrar por isso.
    searchHashtags.mockRejectedValue(new Error("[echotik-client] 500"));

    const res = await GET(
      makeGetRequest("/api/admin/settings/shopee/hashtags", { q: "shopee" }) as any,
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.hashtags).toEqual([]);
    expect(body.error).toBeTruthy();
  });
});
